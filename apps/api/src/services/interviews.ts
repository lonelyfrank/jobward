import { newId, type Database } from '@meet-roulette/database';
import {
  type CompleteInterviewInput,
  type CreateInterviewInput,
  type Interview,
  type UpdateInterviewInput,
} from '@meet-roulette/schemas';
import { LIMITS } from '@meet-roulette/shared';
import { sql } from 'drizzle-orm';
import { ApiError, conflict, notFound } from '../lib/errors';
import { isConstraintError } from './ordering';
import { eventStatement, touchBoard } from './events';
import { getCard } from './cards';

/**
 * Colloqui (M2.5). Regole di business (docs/m25/interview-domain.md):
 *  - creare/modificare/completare un colloquio NON cambia colonna, fase, esito generale;
 *  - lo stato (organizzativo) e l'esito del colloquio sono separati; l'esito vale solo se completato;
 *  - un colloquio annullato non è mai il «prossimo»; i round non si eliminano (si annullano);
 *  - le scritture richiedono scheda non archiviata, la lettura no (lo storico si conserva);
 *  - gli eventi non contengono note né feedback: solo id, numero del round, date, esito.
 */

interface Row {
  id: string;
  cardId: string;
  sequence: number;
  title: string;
  type: Interview['type'];
  status: Interview['status'];
  scheduledAt: number | null;
  timezone: string | null;
  durationMinutes: number | null;
  modality: Interview['modality'];
  location: string | null;
  meetingUrl: string | null;
  interviewers: string;
  preparationNotes: string | null;
  feedbackNotes: string | null;
  result: Interview['result'];
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

const SELECT = sql`
  SELECT id, card_id AS cardId, sequence, title, type, status, scheduled_at AS scheduledAt, timezone,
         duration_minutes AS durationMinutes, modality, location, meeting_url AS meetingUrl, interviewers,
         preparation_notes AS preparationNotes, feedback_notes AS feedbackNotes, result,
         completed_at AS completedAt, created_at AS createdAt, updated_at AS updatedAt
  FROM interviews`;

function parseInterviewers(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

const toInterview = (row: Row): Interview => ({
  ...row,
  interviewers: parseInterviewers(row.interviewers),
});

export async function listInterviews(
  db: Database,
  workspaceId: string,
  cardId: string,
): Promise<Interview[]> {
  await getCard(db, workspaceId, cardId); // 404 se la scheda non è del workspace
  const rows = await db.all<Row>(
    sql`${SELECT} WHERE workspace_id = ${workspaceId} AND card_id = ${cardId} ORDER BY sequence`,
  );
  return rows.map(toInterview);
}

export async function getInterview(
  db: Database,
  workspaceId: string,
  interviewId: string,
): Promise<Interview> {
  const row = await db.get<Row>(
    sql`${SELECT} WHERE workspace_id = ${workspaceId} AND id = ${interviewId}`,
  );
  if (!row) throw notFound('Colloquio'); // inesistente o di un altro workspace: stessa risposta
  return toInterview(row);
}

// ---------------------------------------------------------------------------
// Scritture
// ---------------------------------------------------------------------------

async function workspaceTimezone(db: Database, workspaceId: string): Promise<string> {
  const row = await db.get<{ timezone: string }>(
    sql`SELECT timezone FROM workspaces WHERE id = ${workspaceId}`,
  );
  return row?.timezone ?? 'UTC';
}

function assertCardEditable(archivedAt: number | null) {
  if (archivedAt !== null) {
    throw conflict('La candidatura è archiviata: ripristinala prima di modificare i colloqui');
  }
}

/**
 * Crea un round. Il numero d'ordine, il tetto per scheda e l'appartenenza al workspace sono
 * verificati nella STESSA istruzione (nessuna finestra di concorrenza). Non tocca colonna, fase
 * o esito della scheda.
 */
export async function createInterview(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  userId: string,
  cardId: string,
  input: CreateInterviewInput,
  now: number,
): Promise<Interview> {
  const card = await getCard(db, workspaceId, cardId);
  assertCardEditable(card.archivedAt);
  let previous: Interview | null = null;
  if (input.followUpOf) {
    previous = await getInterview(db, workspaceId, input.followUpOf);
    if (previous.cardId !== cardId) throw notFound('Colloquio'); // di un'altra candidatura
  }
  const scheduledAt = input.scheduledAt ?? null;
  const timezone =
    input.timezone ?? (scheduledAt !== null ? await workspaceTimezone(db, workspaceId) : null);
  const id = newId();

  const nextSeq = `COALESCE((SELECT max(sequence) FROM interviews WHERE card_id = k.id), 0) + 1`;
  let statements: D1PreparedStatement[];
  try {
    statements = [
      d1
        .prepare(
          `INSERT INTO interviews (id, workspace_id, card_id, sequence, title, type, status, scheduled_at, timezone,
              duration_minutes, modality, location, meeting_url, interviewers, preparation_notes, created_at, updated_at)
           SELECT ?1, k.workspace_id, k.id, ${nextSeq}, COALESCE(?4, 'Round ' || (${nextSeq})), ?5, ?6, ?7, ?8,
                  ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15
           FROM cards k
           WHERE k.id = ?2 AND k.workspace_id = ?3 AND k.archived_at IS NULL
             AND (SELECT count(*) FROM interviews WHERE card_id = k.id) < ?16`,
        )
        .bind(
          id,
          cardId,
          workspaceId,
          input.title ?? null,
          input.type,
          scheduledAt !== null ? 'scheduled' : 'to_schedule',
          scheduledAt,
          timezone,
          input.durationMinutes ?? null,
          input.modality ?? null,
          input.location ?? null,
          input.meetingUrl ?? null,
          JSON.stringify(input.interviewers),
          input.preparationNotes ?? null,
          now,
          LIMITS.interviewsPerCardMax,
        ),
      // Evento solo se il round esiste davvero. `sequence` nei metadati si legge dalla riga creata.
      d1
        .prepare(
          `INSERT INTO activity_events (id, workspace_id, board_id, card_id, actor_user_id, type, metadata, occurred_at)
           SELECT ?1, i.workspace_id, k.board_id, k.id, ?2, ?3,
                  json_object('interviewId', i.id, 'sequence', i.sequence, 'scheduledAt', i.scheduled_at${previous ? ", 'previousSequence', " + previous.sequence : ''}),
                  ?4
           FROM interviews i JOIN cards k ON k.id = i.card_id AND k.workspace_id = i.workspace_id
           WHERE i.id = ?5 AND i.workspace_id = ?6`,
        )
        .bind(
          newId(),
          userId,
          previous ? 'interview_next_round_created' : 'interview_created',
          now,
          id,
          workspaceId,
        ),
      d1
        .prepare(
          `UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3
             AND EXISTS (SELECT 1 FROM interviews WHERE id = ?4)`,
        )
        .bind(now, cardId, workspaceId, id),
      touchBoard(d1, workspaceId, card.boardId, now),
    ];
    const [first] = await d1.batch(statements);
    if (!first || first.meta.changes !== 1) {
      throw conflict(
        `Una candidatura può avere al massimo ${LIMITS.interviewsPerCardMax} round di colloquio`,
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isConstraintError(error)) {
      throw conflict('Un altro round è stato creato nello stesso momento: riprova');
    }
    throw error;
  }
  return getInterview(db, workspaceId, id);
}

/** Colonne modificabili: insieme chiuso e costante (nessun nome di colonna dall'input). */
const EDITABLE = {
  title: 'title',
  type: 'type',
  scheduledAt: 'scheduled_at',
  timezone: 'timezone',
  durationMinutes: 'duration_minutes',
  modality: 'modality',
  location: 'location',
  meetingUrl: 'meeting_url',
  interviewers: 'interviewers',
  preparationNotes: 'preparation_notes',
  feedbackNotes: 'feedback_notes',
  result: 'result',
} as const;
type EditableKey = keyof typeof EDITABLE;

export async function updateInterview(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  userId: string,
  interviewId: string,
  input: UpdateInterviewInput,
  now: number,
): Promise<Interview> {
  const current = await getInterview(db, workspaceId, interviewId);
  const card = await getCard(db, workspaceId, current.cardId);
  assertCardEditable(card.archivedAt);

  if (current.status === 'cancelled') {
    throw conflict('Il colloquio è annullato e non si può modificare: crea un nuovo round');
  }
  const open = current.status === 'to_schedule' || current.status === 'scheduled';
  if (!open && (input.scheduledAt !== undefined || input.timezone !== undefined)) {
    throw conflict('La data di un colloquio completato non si cambia');
  }
  if (open && (input.feedbackNotes !== undefined || input.result !== undefined)) {
    throw conflict('Il feedback e l’esito si registrano completando il colloquio');
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    sets.push(`${column} = ?${values.length + 1}`);
    values.push(value);
  };
  for (const key of Object.keys(EDITABLE) as EditableKey[]) {
    const value = input[key];
    if (value === undefined) continue;
    set(EDITABLE[key], key === 'interviewers' ? JSON.stringify(value) : value);
  }
  // Programmare/riprogrammare: lo stato segue la data (nessun automatismo sulla scheda).
  let nextStatus: Interview['status'] = current.status;
  if (open && input.scheduledAt !== undefined) {
    nextStatus = input.scheduledAt === null ? 'to_schedule' : 'scheduled';
    set('status', nextStatus);
    if (input.scheduledAt !== null && input.timezone === undefined && !current.timezone) {
      set('timezone', await workspaceTimezone(db, workspaceId));
    }
  }
  set('updated_at', now);

  const statements: D1PreparedStatement[] = [
    d1
      .prepare(
        `UPDATE interviews SET ${sets.join(', ')}
         WHERE id = ?${values.length + 1} AND workspace_id = ?${values.length + 2} AND status = ?${values.length + 3}`,
      )
      .bind(...values, interviewId, workspaceId, current.status),
  ];

  const base = { workspaceId, boardId: card.boardId, cardId: card.id, actorUserId: userId, now };
  const guard = 'EXISTS (SELECT 1 FROM interviews i WHERE i.id = ?9 AND i.updated_at = ?8)';
  if (input.scheduledAt !== undefined && input.scheduledAt !== current.scheduledAt) {
    statements.push(
      eventStatement(d1, {
        ...base,
        type: 'interview_rescheduled',
        metadata: {
          interviewId,
          sequence: current.sequence,
          from: current.scheduledAt,
          to: input.scheduledAt,
        },
        guard,
        guardBinds: [interviewId],
      }),
    );
  }
  const feedbackNow = input.feedbackNotes !== undefined && input.feedbackNotes !== null;
  const feedbackChanged =
    (feedbackNow && input.feedbackNotes !== current.feedbackNotes) ||
    (input.result !== undefined && input.result !== current.result);
  if (feedbackChanged) {
    statements.push(
      eventStatement(d1, {
        ...base,
        type: 'interview_feedback_recorded',
        // Mai il testo del feedback: solo l'esito del round.
        metadata: {
          interviewId,
          sequence: current.sequence,
          result: input.result ?? current.result,
        },
        guard,
        guardBinds: [interviewId],
      }),
    );
  }
  statements.push(
    d1
      .prepare(`UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3`)
      .bind(now, card.id, workspaceId),
    touchBoard(d1, workspaceId, card.boardId, now),
  );

  const [update] = await runBatch(d1, statements);
  if (!update || update.meta.changes !== 1) {
    throw conflict('Il colloquio è cambiato nel frattempo: aggiorna la pagina');
  }
  return getInterview(db, workspaceId, interviewId);
}

async function runBatch(d1: D1Database, statements: D1PreparedStatement[]) {
  try {
    return await d1.batch(statements);
  } catch (error) {
    if (isConstraintError(error)) {
      throw conflict('I dati del colloquio sono incoerenti con il suo stato: aggiorna la pagina');
    }
    throw error;
  }
}

/** Completa un round (da «da programmare» o «programmato»). Non conclude la candidatura. */
export async function completeInterview(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  userId: string,
  interviewId: string,
  input: CompleteInterviewInput,
  now: number,
): Promise<Interview> {
  const current = await getInterview(db, workspaceId, interviewId);
  const card = await getCard(db, workspaceId, current.cardId);
  assertCardEditable(card.archivedAt);
  if (current.status !== 'to_schedule' && current.status !== 'scheduled') {
    throw conflict(
      current.status === 'completed'
        ? 'Il colloquio è già completato: modifica il feedback invece'
        : 'Il colloquio è annullato',
    );
  }
  const completedAt = input.completedAt ?? now;
  const feedback = input.feedbackNotes ?? null;
  const result = input.result ?? null;
  const base = { workspaceId, boardId: card.boardId, cardId: card.id, actorUserId: userId, now };
  const guard =
    "EXISTS (SELECT 1 FROM interviews i WHERE i.id = ?9 AND i.status = 'completed' AND i.updated_at = ?8)";
  const statements: D1PreparedStatement[] = [
    d1
      .prepare(
        `UPDATE interviews SET status = 'completed', completed_at = ?1, feedback_notes = COALESCE(?2, feedback_notes),
                result = ?3, updated_at = ?4
         WHERE id = ?5 AND workspace_id = ?6 AND status = ?7`,
      )
      .bind(completedAt, feedback, result, now, interviewId, workspaceId, current.status),
    eventStatement(d1, {
      ...base,
      type: 'interview_completed',
      metadata: { interviewId, sequence: current.sequence, result },
      guard,
      guardBinds: [interviewId],
    }),
    ...(feedback !== null
      ? [
          eventStatement(d1, {
            ...base,
            type: 'interview_feedback_recorded',
            metadata: { interviewId, sequence: current.sequence, result },
            guard,
            guardBinds: [interviewId],
          }),
        ]
      : []),
    d1
      .prepare(`UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3`)
      .bind(now, card.id, workspaceId),
    touchBoard(d1, workspaceId, card.boardId, now),
  ];
  const [update] = await runBatch(d1, statements);
  if (!update || update.meta.changes !== 1) {
    throw conflict('Il colloquio è cambiato nel frattempo: aggiorna la pagina');
  }
  return getInterview(db, workspaceId, interviewId);
}

export async function cancelInterview(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  userId: string,
  interviewId: string,
  now: number,
): Promise<Interview> {
  const current = await getInterview(db, workspaceId, interviewId);
  const card = await getCard(db, workspaceId, current.cardId);
  assertCardEditable(card.archivedAt);
  if (current.status !== 'to_schedule' && current.status !== 'scheduled') {
    throw conflict(
      current.status === 'cancelled'
        ? 'Il colloquio è già annullato'
        : 'Un colloquio completato non si annulla',
    );
  }
  const [update] = await runBatch(d1, [
    d1
      .prepare(
        `UPDATE interviews SET status = 'cancelled', updated_at = ?1
         WHERE id = ?2 AND workspace_id = ?3 AND status = ?4`,
      )
      .bind(now, interviewId, workspaceId, current.status),
    eventStatement(d1, {
      workspaceId,
      boardId: card.boardId,
      cardId: card.id,
      actorUserId: userId,
      now,
      type: 'interview_cancelled',
      metadata: { interviewId, sequence: current.sequence },
      guard:
        "EXISTS (SELECT 1 FROM interviews i WHERE i.id = ?9 AND i.status = 'cancelled' AND i.updated_at = ?8)",
      guardBinds: [interviewId],
    }),
    d1
      .prepare(`UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3`)
      .bind(now, card.id, workspaceId),
    touchBoard(d1, workspaceId, card.boardId, now),
  ]);
  if (!update || update.meta.changes !== 1) {
    throw conflict('Il colloquio è cambiato nel frattempo: aggiorna la pagina');
  }
  return getInterview(db, workspaceId, interviewId);
}
