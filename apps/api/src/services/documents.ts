import { type Database } from '@jobward/database';
import {
  type CardDocument,
  type CreateDocumentInput,
  type UpdateDocumentInput,
} from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { sql } from 'drizzle-orm';
import { ApiError, conflict, notFound } from '../lib/errors';
import { getCard } from './cards';
import { touchBoard } from './events';
import { requestFingerprint } from './idempotency';
import { TOMBSTONE_RETENTION_MS } from './notes';
import { isConstraintError } from './ordering';

/**
 * Riferimenti documentali (M3-C2, D3): titolo, tipo, URL http(s) facoltativo, nota. Il server non
 * carica file e non apre mai l'URL (nessuna richiesta in uscita: niente SSRF né anteprime).
 * Stesse regole delle note: creazione idempotente, tetto atomico, lapide, sola lettura se archiviata.
 */

interface Row {
  id: string;
  cardId: string;
  title: string;
  kind: CardDocument['kind'];
  url: string | null;
  note: string | null;
  requestFingerprint: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

const SELECT = sql`
  SELECT id, card_id AS cardId, title, kind, url, note, request_fingerprint AS requestFingerprint,
         created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt
  FROM card_documents`;

const toDocument = (row: Row): CardDocument => ({
  id: row.id,
  cardId: row.cardId,
  title: row.title,
  kind: row.kind,
  url: row.url,
  note: row.note,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export async function listDocuments(
  db: Database,
  workspaceId: string,
  cardId: string,
): Promise<CardDocument[]> {
  await getCard(db, workspaceId, cardId);
  const rows = await db.all<Row>(
    sql`${SELECT} WHERE workspace_id = ${workspaceId} AND card_id = ${cardId} AND deleted_at IS NULL
        ORDER BY created_at DESC, id DESC`,
  );
  return rows.map(toDocument);
}

async function findRow(db: Database, workspaceId: string, documentId: string) {
  return (
    (await db.get<Row>(
      sql`${SELECT} WHERE workspace_id = ${workspaceId} AND id = ${documentId}`,
    )) ?? null
  );
}

export async function getDocument(
  db: Database,
  workspaceId: string,
  documentId: string,
): Promise<CardDocument> {
  const row = await findRow(db, workspaceId, documentId);
  if (!row || row.deletedAt !== null) throw notFound('Documento');
  return toDocument(row);
}

function assertEditable(archivedAt: number | null) {
  if (archivedAt !== null) {
    throw conflict('La candidatura è archiviata: ripristinala prima di modificare i documenti');
  }
}

function resolveReplay(row: Row, cardId: string, fingerprint: string): CardDocument {
  if (row.deletedAt !== null) {
    throw conflict(
      'Il documento è stato eliminato: non si può ricreare con lo stesso identificativo',
    );
  }
  if (row.cardId !== cardId || row.requestFingerprint !== fingerprint) {
    throw conflict(
      'Questo identificativo è già stato usato per una richiesta diversa: genera un nuovo modulo',
    );
  }
  return toDocument(row);
}

export async function createDocument(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  cardId: string,
  input: CreateDocumentInput,
  now: number,
): Promise<{ document: CardDocument; replayed: boolean }> {
  const card = await getCard(db, workspaceId, cardId);
  const url = input.url ?? null;
  const note = input.note ?? null;
  const fingerprint = await requestFingerprint('document.create', {
    workspaceId,
    cardId,
    title: input.title,
    kind: input.kind,
    url,
    note,
  });
  const existing = await findRow(db, workspaceId, input.id);
  if (existing) return { document: resolveReplay(existing, cardId, fingerprint), replayed: true };
  assertEditable(card.archivedAt);

  try {
    const results = await d1.batch([
      d1
        .prepare(
          `INSERT INTO card_documents (id, workspace_id, card_id, title, kind, url, note, request_fingerprint, created_at, updated_at)
           SELECT ?1, k.workspace_id, k.id, ?4, ?5, ?6, ?7, ?8, ?9, ?9
           FROM cards k
           WHERE k.id = ?2 AND k.workspace_id = ?3 AND k.archived_at IS NULL
             AND (SELECT count(*) FROM card_documents WHERE card_id = k.id AND deleted_at IS NULL) < ?10`,
        )
        .bind(
          input.id,
          cardId,
          workspaceId,
          input.title,
          input.kind,
          url,
          note,
          fingerprint,
          now,
          LIMITS.documentsPerCardMax,
        ),
      d1
        .prepare(
          `UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3
             AND EXISTS (SELECT 1 FROM card_documents WHERE id = ?4 AND workspace_id = ?3)`,
        )
        .bind(now, cardId, workspaceId, input.id),
      touchBoard(d1, workspaceId, card.boardId, now),
    ]);
    if (results[0]?.meta.changes !== 1) {
      throw conflict(
        `Una candidatura può avere al massimo ${LIMITS.documentsPerCardMax} riferimenti documentali`,
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isConstraintError(error)) {
      const raced = await findRow(db, workspaceId, input.id);
      if (raced) return { document: resolveReplay(raced, cardId, fingerprint), replayed: true };
      throw conflict('Identificativo già in uso: genera un nuovo modulo');
    }
    throw error;
  }
  return { document: await getDocument(db, workspaceId, input.id), replayed: false };
}

/** Colonne modificabili: insieme chiuso e costante (nessun nome di colonna dall'input). */
const EDITABLE = { title: 'title', kind: 'kind', url: 'url', note: 'note' } as const;

export async function updateDocument(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  documentId: string,
  input: UpdateDocumentInput,
  now: number,
): Promise<CardDocument> {
  const current = await getDocument(db, workspaceId, documentId);
  const card = await getCard(db, workspaceId, current.cardId);
  assertEditable(card.archivedAt);

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of Object.keys(EDITABLE) as (keyof typeof EDITABLE)[]) {
    const value = input[key];
    if (value === undefined) continue;
    values.push(value);
    sets.push(`${EDITABLE[key]} = ?${values.length}`);
  }
  values.push(now);
  sets.push(`updated_at = ?${values.length}`);
  const n = values.length;

  let results: D1Result[];
  try {
    results = await d1.batch([
      d1
        .prepare(
          `UPDATE card_documents SET ${sets.join(', ')}
           WHERE id = ?${n + 1} AND workspace_id = ?${n + 2} AND deleted_at IS NULL
             AND EXISTS (SELECT 1 FROM cards WHERE id = card_documents.card_id AND archived_at IS NULL)`,
        )
        .bind(...values, documentId, workspaceId),
      d1
        .prepare(
          `UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3
             AND EXISTS (SELECT 1 FROM card_documents WHERE id = ?4 AND updated_at = ?1)`,
        )
        .bind(now, card.id, workspaceId, documentId),
      touchBoard(d1, workspaceId, card.boardId, now),
    ]);
  } catch (error) {
    if (isConstraintError(error)) {
      throw conflict('I dati del documento non sono validi: aggiorna la pagina');
    }
    throw error;
  }
  if (results[0]?.meta.changes !== 1) {
    throw conflict('Il documento è cambiato nel frattempo: aggiorna la pagina');
  }
  return getDocument(db, workspaceId, documentId);
}

export async function deleteDocument(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  documentId: string,
  now: number,
): Promise<void> {
  const row = await findRow(db, workspaceId, documentId);
  if (!row) throw notFound('Documento');
  if (row.deletedAt !== null) return;
  const card = await getCard(db, workspaceId, row.cardId);
  assertEditable(card.archivedAt);
  const results = await d1.batch([
    d1
      .prepare(
        `UPDATE card_documents SET title = '', url = NULL, note = NULL, request_fingerprint = NULL,
                deleted_at = ?1, updated_at = ?1
         WHERE id = ?2 AND workspace_id = ?3 AND deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM cards WHERE id = card_documents.card_id AND archived_at IS NULL)`,
      )
      .bind(now, documentId, workspaceId),
    d1
      .prepare(
        `DELETE FROM card_documents WHERE workspace_id = ?1 AND card_id = ?2 AND deleted_at IS NOT NULL
           AND deleted_at < ?3`,
      )
      .bind(workspaceId, card.id, now - TOMBSTONE_RETENTION_MS),
    d1
      .prepare(
        `UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3
           AND EXISTS (SELECT 1 FROM card_documents WHERE id = ?4 AND deleted_at = ?1)`,
      )
      .bind(now, card.id, workspaceId, documentId),
    touchBoard(d1, workspaceId, card.boardId, now),
  ]);
  if (results[0]?.meta.changes !== 1) {
    const after = await findRow(db, workspaceId, documentId);
    if (after?.deletedAt != null) return;
    throw conflict('Il documento o la candidatura sono cambiati nel frattempo: aggiorna la pagina');
  }
}
