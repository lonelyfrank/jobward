import { type Database } from '@jobward/database';
import { type CreateNoteInput, type Note, type UpdateNoteInput } from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { sql } from 'drizzle-orm';
import { ApiError, conflict, notFound } from '../lib/errors';
import { getCard } from './cards';
import { touchBoard } from './events';
import { requestFingerprint } from './idempotency';
import { isConstraintError } from './ordering';

/**
 * Note manuali (M3-C2). Regole (docs/m3/plan.md §4):
 *  - il testo vive solo qui: la cronologia di sistema non lo copia;
 *  - creazione idempotente con ID del client + fingerprint immutabile; tetto per scheda atomico;
 *  - scritture solo su candidature non archiviate (409), lettura sempre;
 *  - l'eliminazione lascia una lapide senza testo: un retry tardivo non ricrea la nota.
 */

interface Row {
  id: string;
  cardId: string;
  body: string;
  requestFingerprint: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

const SELECT = sql`
  SELECT id, card_id AS cardId, body, request_fingerprint AS requestFingerprint,
         created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt
  FROM card_notes`;

const toNote = (row: Row): Note => ({
  id: row.id,
  cardId: row.cardId,
  body: row.body,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Le lapidi più vecchie di così non servono più a bloccare un retry: si ripuliscono. */
export const TOMBSTONE_RETENTION_MS = 30 * 24 * 3_600_000;

const SAME_ID_OTHER_REQUEST =
  'Questo identificativo è già stato usato per una richiesta diversa: genera un nuovo modulo';

export async function listNotes(
  db: Database,
  workspaceId: string,
  cardId: string,
): Promise<Note[]> {
  await getCard(db, workspaceId, cardId);
  const rows = await db.all<Row>(
    sql`${SELECT} WHERE workspace_id = ${workspaceId} AND card_id = ${cardId} AND deleted_at IS NULL
        ORDER BY created_at DESC, id DESC`,
  );
  return rows.map(toNote);
}

async function findRow(db: Database, workspaceId: string, noteId: string) {
  return (
    (await db.get<Row>(sql`${SELECT} WHERE workspace_id = ${workspaceId} AND id = ${noteId}`)) ??
    null
  );
}

export async function getNote(db: Database, workspaceId: string, noteId: string): Promise<Note> {
  const row = await findRow(db, workspaceId, noteId);
  if (!row || row.deletedAt !== null) throw notFound('Nota'); // inesistente, eliminata o altrui
  return toNote(row);
}

function assertEditable(archivedAt: number | null) {
  if (archivedAt !== null) {
    throw conflict('La candidatura è archiviata: ripristinala prima di modificare le note');
  }
}

/** Replay (stesso ID, stessa richiesta) → la nota esistente; altrimenti 409 senza toccare nulla. */
function resolveReplay(row: Row, cardId: string, fingerprint: string): Note {
  if (row.deletedAt !== null) {
    throw conflict('La nota è stata eliminata: non si può ricreare con lo stesso identificativo');
  }
  if (row.cardId !== cardId || row.requestFingerprint !== fingerprint) {
    throw conflict(SAME_ID_OTHER_REQUEST);
  }
  return toNote(row);
}

export async function createNote(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  cardId: string,
  input: CreateNoteInput,
  now: number,
): Promise<{ note: Note; replayed: boolean }> {
  const card = await getCard(db, workspaceId, cardId); // 404 anche per una scheda altrui
  const fingerprint = await requestFingerprint('note.create', {
    workspaceId,
    cardId,
    body: input.body,
  });
  const existing = await findRow(db, workspaceId, input.id);
  if (existing) return { note: resolveReplay(existing, cardId, fingerprint), replayed: true };
  assertEditable(card.archivedAt);

  try {
    const results = await d1.batch([
      d1
        .prepare(
          `INSERT INTO card_notes (id, workspace_id, card_id, body, request_fingerprint, created_at, updated_at)
           SELECT ?1, k.workspace_id, k.id, ?4, ?5, ?6, ?6
           FROM cards k
           WHERE k.id = ?2 AND k.workspace_id = ?3 AND k.archived_at IS NULL
             AND (SELECT count(*) FROM card_notes WHERE card_id = k.id AND deleted_at IS NULL) < ?7`,
        )
        .bind(input.id, cardId, workspaceId, input.body, fingerprint, now, LIMITS.notesPerCardMax),
      d1
        .prepare(
          `UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3
             AND EXISTS (SELECT 1 FROM card_notes WHERE id = ?4 AND workspace_id = ?3)`,
        )
        .bind(now, cardId, workspaceId, input.id),
      touchBoard(d1, workspaceId, card.boardId, now),
    ]);
    if (results[0]?.meta.changes !== 1) {
      throw conflict(`Una candidatura può avere al massimo ${LIMITS.notesPerCardMax} note`);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isConstraintError(error)) {
      // Richiesta concorrente con lo stesso ID: converge sulla stessa nota o perde con 409.
      const raced = await findRow(db, workspaceId, input.id);
      if (raced) return { note: resolveReplay(raced, cardId, fingerprint), replayed: true };
      throw conflict('Identificativo già in uso: genera un nuovo modulo');
    }
    throw error;
  }
  return { note: await getNote(db, workspaceId, input.id), replayed: false };
}

export async function updateNote(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  noteId: string,
  input: UpdateNoteInput,
  now: number,
): Promise<Note> {
  const current = await getNote(db, workspaceId, noteId);
  const card = await getCard(db, workspaceId, current.cardId);
  assertEditable(card.archivedAt);
  const results = await d1.batch([
    d1
      .prepare(
        `UPDATE card_notes SET body = ?1, updated_at = ?2
         WHERE id = ?3 AND workspace_id = ?4 AND deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM cards WHERE id = card_notes.card_id AND archived_at IS NULL)`,
      )
      .bind(input.body, now, noteId, workspaceId),
    d1
      .prepare(
        `UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3
           AND EXISTS (SELECT 1 FROM card_notes WHERE id = ?4 AND updated_at = ?1)`,
      )
      .bind(now, card.id, workspaceId, noteId),
    touchBoard(d1, workspaceId, card.boardId, now),
  ]);
  if (results[0]?.meta.changes !== 1) {
    throw conflict('La nota è cambiata nel frattempo: aggiorna la pagina');
  }
  return getNote(db, workspaceId, noteId);
}

/** Idempotente: eliminare una nota già eliminata (retry dopo risposta persa) riesce. */
export async function deleteNote(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  noteId: string,
  now: number,
): Promise<void> {
  const row = await findRow(db, workspaceId, noteId);
  if (!row) throw notFound('Nota');
  if (row.deletedAt !== null) return;
  const card = await getCard(db, workspaceId, row.cardId);
  assertEditable(card.archivedAt);
  const results = await d1.batch([
    d1
      .prepare(
        `UPDATE card_notes SET body = '', request_fingerprint = NULL, deleted_at = ?1, updated_at = ?1
         WHERE id = ?2 AND workspace_id = ?3 AND deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM cards WHERE id = card_notes.card_id AND archived_at IS NULL)`,
      )
      .bind(now, noteId, workspaceId),
    d1
      .prepare(
        `DELETE FROM card_notes WHERE workspace_id = ?1 AND card_id = ?2 AND deleted_at IS NOT NULL
           AND deleted_at < ?3`,
      )
      .bind(workspaceId, card.id, now - TOMBSTONE_RETENTION_MS),
    d1
      .prepare(
        `UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3
           AND EXISTS (SELECT 1 FROM card_notes WHERE id = ?4 AND deleted_at = ?1)`,
      )
      .bind(now, card.id, workspaceId, noteId),
    touchBoard(d1, workspaceId, card.boardId, now),
  ]);
  if (results[0]?.meta.changes !== 1) {
    // Eliminata nel frattempo da un'altra richiesta (esito identico) oppure candidatura archiviata.
    const after = await findRow(db, workspaceId, noteId);
    if (after?.deletedAt != null) return;
    throw conflict('La nota o la candidatura sono cambiate nel frattempo: aggiorna la pagina');
  }
}
