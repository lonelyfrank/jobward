import { newId, type Database } from '@jobward/database';
import type { PipelineTransitionInput, PipelineTransitionResponse } from '@jobward/schemas';
import { evaluatePipelineTransition, type PipelineStatus } from '@jobward/shared';
import { sql } from 'drizzle-orm';
import { ApiError, conflict } from '../lib/errors';
import { applicationEventStatement, snapshotStatement } from './applications';
import { getCard } from './cards';
import { requestFingerprint } from './idempotency';
import { isConstraintError } from './ordering';

/**
 * Transizioni della pipeline (docs/features/APPLICATIONS.md). Il motore puro di C1 decide; qui si
 * rivalida e si scrive ATOMICAMENTE in una sola `batch()`:
 *
 *   1. eventi (il primo è il «claim» dell'operazione: indice univoco `dedupe_key` per workspace),
 *      ciascuno inseribile solo se la scheda ha ancora lo stato osservato (compare-and-swap);
 *   2. facoltativo: annullamento dei colloqui futuri, con il loro evento, solo se il claim esiste;
 *   3. aggiornamento di fase/esito (stesso compare-and-swap) e «touch» di scheda e bacheca.
 *
 * D1 serializza le batch: o tutto o niente. Un retry identico con lo stesso ID converge sul risultato
 * già scritto (replay, nessun secondo evento); lo stesso ID con una richiesta diversa è 409.
 */

const REASON_MESSAGES = {
  archived: 'La candidatura è archiviata: ripristinala prima di cambiarne lo stato',
  target_archived: 'L’archiviazione non è una transizione di stato',
  stale_state: 'Lo stato della candidatura è cambiato nel frattempo: aggiorna la pagina',
  invalid_transition: 'Questa transizione non è consentita dallo stato attuale',
  unchanged: 'La candidatura è già in questo stato',
  legacy_state_requires_correction:
    'La fase «Chiusa» non ha un esito: usa «Correggi stato» per sistemarla',
} as const;

interface OperationRow {
  cardId: string | null;
  type: string;
  metadata: string;
  requestFingerprint: string;
}

/** Eventi già scritti da questa operazione (se ce ne sono), nel workspace. */
async function findOperation(db: Database, workspaceId: string, operationId: string) {
  return db.all<OperationRow>(
    sql`SELECT card_id AS cardId, type, metadata, request_fingerprint AS requestFingerprint
        FROM activity_events
        WHERE workspace_id = ${workspaceId} AND operation_id = ${operationId}
        ORDER BY occurred_at, id`,
  );
}

function readFromStatus(rows: OperationRow[]): PipelineStatus | null {
  for (const row of rows) {
    try {
      const value: unknown = JSON.parse(row.metadata);
      const from = (value as Record<string, unknown> | null)?.['fromStatus'];
      if (typeof from === 'string') return from as PipelineStatus;
    } catch {
      /* metadati illeggibili: si ignorano */
    }
  }
  return null;
}

export async function transitionCard(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  userId: string,
  cardId: string,
  input: PipelineTransitionInput,
  now: number,
): Promise<PipelineTransitionResponse> {
  const card = await getCard(db, workspaceId, cardId); // 404 anche per una scheda altrui

  // Fingerprint della richiesta normalizzata (default esplicito: «assente» ≡ «keep»).
  const fingerprint = await requestFingerprint('pipeline.transition', {
    workspaceId,
    cardId,
    to: input.to,
    kind: input.kind,
    expectedFrom: input.expectedFrom ?? null,
    appliedOn: input.appliedOn ?? null,
    futureInterviews: input.futureInterviews ?? 'keep',
  });

  const replay = async (): Promise<PipelineTransitionResponse | null> => {
    const rows = await findOperation(db, workspaceId, input.id);
    if (rows.length === 0) return null;
    if (rows.some((r) => r.cardId !== cardId || r.requestFingerprint !== fingerprint)) {
      throw conflict(
        'Questo identificativo è già stato usato per un’operazione diversa: genera un nuovo ID',
      );
    }
    const current = await getCard(db, workspaceId, cardId);
    return {
      card: current,
      transition: {
        id: input.id,
        kind: input.kind,
        from: readFromStatus(rows) ?? input.expectedFrom ?? input.to,
        to: input.to,
      },
      replayed: true,
      cancelledInterviews: rows.filter((r) => r.type === 'interview_cancelled').length,
      warnings: [],
    };
  };
  const already = await replay();
  if (already) return already;

  const decision = evaluatePipelineTransition({
    current: { stage: card.stage, outcome: card.outcome, archivedAt: card.archivedAt },
    to: input.to,
    kind: input.kind,
    cardId,
    operationId: input.id,
    ...(input.expectedFrom ? { expectedFrom: input.expectedFrom } : {}),
    interviews: { summary: card.interviewSummary },
  });
  if (!decision.allowed) {
    if (decision.reason === 'missing_identity') {
      throw new ApiError(400, 'validation_error', 'Dati non validi');
    }
    throw conflict(REASON_MESSAGES[decision.reason]);
  }

  const claim = decision.events[0];
  if (!claim) throw new ApiError(500, 'internal_error', 'Transizione senza eventi');
  const { fields } = decision;

  // La candidatura su cui si opera: la corrente, oppure una NUOVA (sequenza 1) se l'opportunità non ne ha.
  const creating = card.applicationId === null;
  const applicationId = card.applicationId ?? newId();

  // Compare-and-swap sullo stato OSSERVATO della candidatura corrente (NULL/NULL se non ce n'è).
  const stateGuard = `EXISTS (SELECT 1 FROM cards k LEFT JOIN current_applications ca ON ca.opportunity_id = k.id
      WHERE k.id = ?4 AND k.workspace_id = ?2 AND k.archived_at IS NULL AND ca.stage IS ?13 AND ca.outcome IS ?14
        AND ca.id IS ?15)`;
  // Creando, gli eventi seguono l'inserimento della candidatura: la loro guardia è la sua esistenza.
  const eventGuard = creating
    ? `EXISTS (SELECT 1 FROM applications WHERE id = ?12 AND workspace_id = ?2 AND opportunity_id = ?4)`
    : stateGuard;
  const claimExists = (ws: string, key: string) =>
    `EXISTS (SELECT 1 FROM activity_events WHERE workspace_id = ${ws} AND dedupe_key = ${key})`;

  const eventStatements = decision.events.map((event) => {
    const metadata =
      event.type === 'application_submitted' && input.appliedOn
        ? { ...event.metadata, appliedOn: input.appliedOn }
        : event.metadata;
    return d1
      .prepare(
        `INSERT INTO activity_events (id, workspace_id, board_id, card_id, actor_user_id, type, metadata, occurred_at,
            dedupe_key, operation_id, request_fingerprint, application_id)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
         WHERE ${eventGuard}`,
      )
      .bind(
        newId(),
        workspaceId,
        card.boardId,
        cardId,
        userId,
        event.type,
        JSON.stringify(metadata),
        now,
        event.dedupeKey,
        input.id,
        fingerprint,
        applicationId,
        ...(creating ? [] : [card.stage, card.outcome, card.applicationId]),
      );
  });

  // Colloqui futuri: solo chiudendo, solo se richiesto esplicitamente («keep» è il predefinito).
  const cancelStatements: D1PreparedStatement[] = [];
  if (input.futureInterviews === 'cancel' && decision.confirmation.manageFutureInterviews) {
    const cancelTargets = await db.all<{ id: string; sequence: number }>(
      sql`SELECT id, sequence FROM interviews
          WHERE workspace_id = ${workspaceId} AND card_id = ${cardId}
            AND status = 'scheduled' AND scheduled_at >= ${now}`,
    );
    for (const target of cancelTargets) {
      const targetKey = JSON.stringify(['interview_cancelled', 'interview', target.id, input.id]);
      cancelStatements.push(
        d1
          .prepare(
            `INSERT INTO activity_events (id, workspace_id, board_id, card_id, actor_user_id, type, metadata, occurred_at,
                dedupe_key, operation_id, request_fingerprint)
             SELECT ?1, i.workspace_id, ?2, i.card_id, ?3, 'interview_cancelled',
                    json_object('interviewId', i.id, 'sequence', i.sequence), ?4, ?5, ?6, ?7
             FROM interviews i
             WHERE i.id = ?8 AND i.workspace_id = ?9 AND i.status = 'scheduled' AND i.scheduled_at >= ?4
               AND ${claimExists('?9', '?10')}`,
          )
          .bind(
            newId(),
            card.boardId,
            userId,
            now,
            targetKey,
            input.id,
            fingerprint,
            target.id,
            workspaceId,
            claim.dedupeKey,
          ),
        d1
          .prepare(
            `UPDATE interviews SET status = 'cancelled', updated_at = ?1
             WHERE id = ?2 AND workspace_id = ?3 AND status = 'scheduled' AND scheduled_at >= ?1
               AND ${claimExists('?3', '?4')}`,
          )
          .bind(now, target.id, workspaceId, claim.dedupeKey),
      );
    }
  }

  const appliedOn = fields.stage === 'applied' ? (input.appliedOn ?? null) : null;
  const applicationStatements: D1PreparedStatement[] = creating
    ? [
        // Prima candidatura: solo se l'opportunità è attiva e non ne ha ancora (compare-and-swap «nessuna»).
        d1
          .prepare(
            `INSERT INTO applications (id, workspace_id, opportunity_id, sequence, stage, outcome, applied_on,
                request_fingerprint, created_at, updated_at)
             SELECT ?1, k.workspace_id, k.id, 1, ?2, ?3, ?4, NULL, ?5, ?5
             FROM cards k
             WHERE k.id = ?6 AND k.workspace_id = ?7 AND k.archived_at IS NULL
               AND NOT EXISTS (SELECT 1 FROM applications WHERE opportunity_id = k.id)`,
          )
          .bind(applicationId, fields.stage, fields.outcome, appliedOn, now, cardId, workspaceId),
        snapshotStatement(d1, { workspaceId, cardId, applicationId, now }),
      ]
    : [];
  const createdEvent = creating
    ? [
        applicationEventStatement(d1, {
          workspaceId,
          boardId: card.boardId,
          cardId,
          applicationId,
          actorUserId: userId,
          type: 'application_created',
          metadata: { applicationId, stage: fields.stage },
          now,
        }),
      ]
    : [];
  // Candidatura esistente: aggiornamento con lo stesso compare-and-swap, solo se il claim è stato scritto.
  const updateStatements: D1PreparedStatement[] = creating
    ? []
    : [
        d1
          .prepare(
            `UPDATE applications SET stage = ?1, outcome = ?2, applied_on = COALESCE(applied_on, ?3), updated_at = ?4
             WHERE id = ?5 AND workspace_id = ?6 AND stage IS ?7 AND outcome IS ?8
               AND ${claimExists('?6', '?9')}`,
          )
          .bind(
            fields.stage,
            fields.outcome,
            appliedOn,
            now,
            applicationId,
            workspaceId,
            card.stage,
            card.outcome,
            claim.dedupeKey,
          ),
      ];

  const touch = [
    d1
      .prepare(
        `UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3 AND ${claimExists('?3', '?4')}`,
      )
      .bind(now, cardId, workspaceId, claim.dedupeKey),
    d1
      .prepare(
        `UPDATE boards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3 AND ${claimExists('?3', '?4')}`,
      )
      .bind(now, card.boardId, workspaceId, claim.dedupeKey),
  ];

  const statements = [
    ...applicationStatements,
    ...eventStatements,
    ...createdEvent,
    ...cancelStatements,
    ...updateStatements,
    ...touch,
  ];
  // L'istruzione che decide l'esito: l'inserimento della candidatura, oppure il claim dell'operazione.
  const decisive = 0;
  const cancelOffset = applicationStatements.length + eventStatements.length + createdEvent.length;

  let results: D1Result[];
  try {
    results = await d1.batch(statements);
  } catch (error) {
    if (!isConstraintError(error)) throw error;
    // Indice univoco del claim: un'altra richiesta con lo stesso ID ha vinto. Si converge su di essa.
    const raced = await replay();
    if (raced) return raced;
    throw conflict('La candidatura è cambiata nel frattempo: aggiorna la pagina');
  }
  if (results[decisive]?.meta.changes !== 1) {
    // Compare-and-swap fallito: stato cambiato (o archiviata). Se nel frattempo la STESSA
    // operazione è stata completata da una richiesta concorrente, è un replay.
    const raced = await replay();
    if (raced) return raced;
    throw conflict(REASON_MESSAGES.stale_state);
  }

  const cancelled = cancelStatements.length
    ? results
        .slice(cancelOffset, cancelOffset + cancelStatements.length)
        .filter((_, index) => index % 2 === 1)
        .reduce((sum, r) => sum + (r.meta.changes ?? 0), 0)
    : 0;
  return {
    card: await getCard(db, workspaceId, cardId),
    transition: { id: input.id, kind: decision.kind, from: decision.from, to: decision.to },
    replayed: false,
    cancelledInterviews: cancelled,
    warnings: decision.warnings.map((w) => ({
      code: w.code,
      ...(w.interviewId ? { interviewId: w.interviewId } : {}),
      ...(w.suggestedStatus ? { suggestedStatus: w.suggestedStatus } : {}),
    })),
  };
}
