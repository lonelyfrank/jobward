import { POSITION_GAP, placeAfter, type Positioned } from '@meet-roulette/shared';
import { conflict } from '../lib/errors';

/**
 * Scritture di ordinamento su D1 (ADR-0004 / ADR-0008).
 *
 * D1 non offre transazioni interattive: non si può leggere, decidere e scrivere dentro la stessa
 * transazione. Si procede quindi così:
 *   1. si LEGGONO i vicini (fuori transazione);
 *   2. si decide la posizione con funzioni pure (`placeAfter`);
 *   3. si scrive con un `batch()` (transazione atomica) le cui istruzioni portano nel SQL le
 *      condizioni che devono valere ancora al momento della scrittura.
 * Se tra 1 e 3 la lista è cambiata, l'esito è comunque un ordine totale e stabile
 * (posizione, id): al peggio l'utente vede la scheda in un punto vicino a quello previsto.
 */

/** Tabelle ordinabili e colonna che identifica la lista di appartenenza. Whitelist chiusa. */
export const ORDERED_LISTS = {
  boards: { table: 'boards', scope: 'workspace_id' },
  columns: { table: 'board_columns', scope: 'board_id' },
  cards: { table: 'cards', scope: 'column_id' },
  customFields: { table: 'custom_field_definitions', scope: 'board_id' },
} as const;
export type OrderedList = keyof typeof ORDERED_LISTS;

/** Vicini attuali di una lista (compresi eventuali elementi archiviati), esclusi `excludeId`. */
export async function readSiblings(
  d1: D1Database,
  list: OrderedList,
  workspaceId: string,
  scopeValue: string,
  excludeId: string,
): Promise<Positioned[]> {
  const { table, scope } = ORDERED_LISTS[list];
  const { results } = await d1
    .prepare(
      `SELECT id, position FROM ${table}
       WHERE workspace_id = ?1 AND ${scope} = ?2 AND id <> ?3
       ORDER BY position, id`,
    )
    .bind(workspaceId, scopeValue, excludeId)
    .all<Positioned>();
  return results;
}

/**
 * Ribilancia i vicini in UNA istruzione: posizione = rango × GAP (window function), senza un
 * parametro per riga (D1 limita i parametri legati e le query per invocazione).
 *
 * ATTENZIONE: la forma `SET position = (SELECT … rango …)` è SBAGLIATA. La sottoquery è
 * rivalutata riga per riga sullo stato già in parte modificato, quindi i ranghi cambiano a metà
 * aggiornamento e l'ordine si inverte. `UPDATE … FROM (SELECT …)` invece fa calcolare tutti i
 * ranghi PRIMA di scrivere (SQLite materializza la SELECT). Verificato da test.
 */
export function rebalanceStatement(
  d1: D1Database,
  list: OrderedList,
  workspaceId: string,
  scopeValue: string,
  excludeId: string,
): D1PreparedStatement {
  const { table, scope } = ORDERED_LISTS[list];
  return d1
    .prepare(
      `UPDATE ${table} SET position = r.rn * ${POSITION_GAP}
       FROM (
         SELECT id, row_number() OVER (ORDER BY position, id) AS rn
         FROM ${table} WHERE workspace_id = ?1 AND ${scope} = ?2 AND id <> ?3
       ) AS r
       WHERE ${table}.id = r.id`,
    )
    .bind(workspaceId, scopeValue, excludeId);
}

/** Decide la collocazione; l'ancora mancante diventa un 409 con messaggio per l'utente. */
export function decidePlacement(siblings: Positioned[], afterId: string | null, what: string) {
  const placement = placeAfter(siblings, afterId);
  if (placement.kind === 'anchor_not_found') {
    throw conflict(`${what} è cambiata nel frattempo: aggiorna la pagina e riprova`);
  }
  return placement;
}

/**
 * Riconosce un errore di vincolo (FK, CHECK, trigger) sollevato da una scrittura concorrente.
 * D1 espone il motivo nel messaggio (`SQLITE_CONSTRAINT…`); altri errori non vanno nascosti.
 */
export function isConstraintError(error: unknown): boolean {
  return error instanceof Error && /SQLITE_CONSTRAINT|FOREIGN KEY constraint/i.test(error.message);
}
