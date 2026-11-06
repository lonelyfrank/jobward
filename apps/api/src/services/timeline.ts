import { type Database } from '@jobward/database';
import type { TimelineResponse } from '@jobward/schemas';
import { mergeTimeline, type TimelineEntry, type TimelineSystemEvent } from '@jobward/shared';
import { sql } from 'drizzle-orm';
import { ApiError } from '../lib/errors';
import { getCard } from './cards';

/**
 * Timeline aggregata di una candidatura (M3-C2, docs/m3/plan.md §4): eventi di sistema ∪ note.
 *  - ordine totale e stabile `(occurredAt, id, source)` decrescente (la funzione pura di C1);
 *  - paginazione a cursore opaco: nessun salto né duplicato se arrivano righe nuove fra due pagine;
 *  - nessuna informazione riservata: i metadati degli eventi passano dalla whitelist del dominio,
 *    si espongono solo ID, tipo, istante e dati strutturati; mai autore, chiavi di deduplica,
 *    fingerprint o identificativi interni di operazione. Il testo di una nota compare solo come
 *    nota (la sua fonte), mai copiato in un evento.
 */

type Source = 'system' | 'note';
interface Cursor {
  occurredAt: number;
  id: string;
  source: Source;
}

export function encodeCursor(entry: Pick<TimelineEntry, 'occurredAt' | 'id' | 'source'>): string {
  const json = JSON.stringify([entry.occurredAt, entry.id, entry.source]);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function decodeCursor(raw: string): Cursor {
  const invalid = () =>
    new ApiError(400, 'validation_error', 'Parametri non validi', [
      { path: 'before', message: 'Cursore non valido' },
    ]);
  try {
    const padded = raw.replaceAll('-', '+').replaceAll('_', '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const value: unknown = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))),
    );
    const parts: unknown[] = Array.isArray(value) ? (value as unknown[]) : [];
    const [at, id, source] = parts;
    if (
      parts.length === 3 &&
      typeof at === 'number' &&
      Number.isSafeInteger(at) &&
      typeof id === 'string' &&
      id.length > 0 &&
      id.length <= 64 &&
      (source === 'system' || source === 'note')
    ) {
      return { occurredAt: at, id, source };
    }
  } catch {
    /* cade nell'errore standard */
  }
  throw invalid();
}

interface EventRow {
  id: string;
  type: TimelineSystemEvent['type'];
  occurredAt: number;
  cardId: string | null;
  metadata: string;
}
interface NoteRow {
  id: string;
  cardId: string;
  createdAt: number;
  body: string;
}

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function getTimeline(
  db: Database,
  workspaceId: string,
  cardId: string,
  query: { before?: string | undefined; limit: number },
): Promise<TimelineResponse> {
  await getCard(db, workspaceId, cardId); // 404 per una scheda inesistente o di un altro workspace
  const cursor = query.before ? decodeCursor(query.before) : null;
  const take = query.limit + 1; // una riga in più per sapere se c'è un'altra pagina

  // «Dopo il cursore» in ordine decrescente per (istante, id, source). A parità di istante e di id
  // viene prima `system` (source maggiore): una nota con lo stesso id segue solo un evento di sistema.
  const eventAfter = cursor
    ? sql`AND (occurred_at < ${cursor.occurredAt} OR (occurred_at = ${cursor.occurredAt} AND id < ${cursor.id}))`
    : sql``;
  const noteAfter = cursor
    ? sql`AND (created_at < ${cursor.occurredAt} OR (created_at = ${cursor.occurredAt}
          AND (id < ${cursor.id} OR (id = ${cursor.id} AND ${cursor.source === 'system' ? 1 : 0} = 1))))`
    : sql``;

  const events = await db.all<EventRow>(
    sql`SELECT id, type, occurred_at AS occurredAt, card_id AS cardId, metadata FROM activity_events
        WHERE workspace_id = ${workspaceId} AND card_id = ${cardId} ${eventAfter}
        ORDER BY occurred_at DESC, id DESC LIMIT ${take}`,
  );
  const notes = await db.all<NoteRow>(
    sql`SELECT id, card_id AS cardId, created_at AS createdAt, body FROM card_notes
        WHERE workspace_id = ${workspaceId} AND card_id = ${cardId} AND deleted_at IS NULL ${noteAfter}
        ORDER BY created_at DESC, id DESC LIMIT ${take}`,
  );

  const merged = mergeTimeline(
    events.map((e) => ({
      id: e.id,
      type: e.type,
      occurredAt: e.occurredAt,
      cardId: e.cardId,
      metadata: parseMetadata(e.metadata),
    })),
    notes,
  );
  const page = merged.slice(0, query.limit);
  const last = page.at(-1);
  return {
    entries: page,
    nextCursor: merged.length > query.limit && last ? encodeCursor(last) : null,
  };
}
