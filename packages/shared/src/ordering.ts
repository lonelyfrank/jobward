/**
 * Ordinamento stabile con posizioni a gap (ADR-0004).
 *
 * Ogni elemento di una lista ordinata (bacheche di un workspace, colonne di una bacheca,
 * schede di una colonna) ha una posizione intera. Le posizioni sono distanziate di `POSITION_GAP`,
 * così inserire tra due elementi richiede di scrivere UNA sola riga (il punto medio).
 * Quando il gap si esaurisce (o esistono posizioni duplicate) la lista viene ribilanciata.
 *
 * Queste funzioni sono PURE e condivise: il server le usa per decidere cosa scrivere, il client
 * per l'aggiornamento ottimistico. Così le due viste dello stato non possono divergere.
 *
 * Ordine canonico: `position` crescente, a parità l'`id` (confronto binario): totale e
 * deterministico anche in presenza di duplicati. Deve coincidere con `ORDER BY position, id` in SQL.
 */

export const POSITION_GAP = 1024;

export interface Positioned {
  id: string;
  position: number;
}

/** Confronto canonico (posizione, poi id). Gli id sono UUID ASCII: stesso esito di SQLite BINARY. */
export function comparePositioned(a: Positioned, b: Positioned): number {
  if (a.position !== b.position) return a.position - b.position;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortPositioned<T extends Positioned>(items: readonly T[]): T[] {
  return [...items].sort(comparePositioned);
}

/** Posizione per un elemento accodato alla fine della lista. */
export function appendPosition(maxPosition: number | null): number {
  return maxPosition === null ? POSITION_GAP : maxPosition + POSITION_GAP;
}

export type Placement =
  | {
      kind: 'ok';
      /** Nuova posizione dell'elemento spostato. */
      position: number;
      /** Se true la lista va prima ribilanciata: i fratelli sono riscritti in `rebalanced`. */
      rebalance: false;
    }
  | {
      kind: 'ok';
      position: number;
      rebalance: true;
      /** Nuove posizioni dei FRATELLI (l'elemento spostato è escluso), nell'ordine corrente. */
      rebalanced: Positioned[];
    }
  | { kind: 'anchor_not_found' };

/**
 * Calcola dove collocare un elemento "subito dopo" `afterId` (oppure in cima se `null`).
 *
 * @param siblings   elementi della lista di destinazione, ESCLUSO quello spostato
 * @param afterId    id dell'elemento che deve precedere quello spostato; `null` = in cima
 */
export function placeAfter(siblings: readonly Positioned[], afterId: string | null): Placement {
  const ordered = sortPositioned(siblings);

  let index = -1; // indice dell'elemento precedente
  if (afterId !== null) {
    index = ordered.findIndex((item) => item.id === afterId);
    if (index === -1) return { kind: 'anchor_not_found' };
  }

  const prev = index >= 0 ? ordered[index]!.position : null;
  const next = ordered[index + 1]?.position ?? null;

  if (prev === null && next === null)
    return { kind: 'ok', position: POSITION_GAP, rebalance: false };
  if (prev === null) return { kind: 'ok', position: next! - POSITION_GAP, rebalance: false };
  if (next === null) return { kind: 'ok', position: prev + POSITION_GAP, rebalance: false };
  if (next - prev >= 2) {
    return { kind: 'ok', position: prev + Math.floor((next - prev) / 2), rebalance: false };
  }

  // Gap esaurito o posizioni duplicate: ribilanciamento. I fratelli ricevono (i+1)*GAP e
  // l'elemento spostato si colloca a metà tra il precedente e il successivo ribilanciati.
  const rebalanced = ordered.map((item, i) => ({ id: item.id, position: (i + 1) * POSITION_GAP }));
  return {
    kind: 'ok',
    position: (index + 1) * POSITION_GAP + POSITION_GAP / 2,
    rebalance: true,
    rebalanced,
  };
}

/**
 * Applica uno spostamento a una lista in memoria (uso lato client, aggiornamento ottimistico):
 * restituisce la lista risultante, già ordinata, o `null` se l'ancora non esiste.
 */
export function applyPlacement<T extends Positioned>(
  siblings: readonly T[],
  moved: T,
  afterId: string | null,
): T[] | null {
  const placement = placeAfter(siblings, afterId);
  if (placement.kind === 'anchor_not_found') return null;

  const base = placement.rebalance
    ? siblings.map((item) => ({
        ...item,
        position: placement.rebalanced.find((r) => r.id === item.id)!.position,
      }))
    : [...siblings];
  return sortPositioned([...base, { ...moved, position: placement.position }]);
}

/** L'ancora (elemento precedente) di `id` nella lista ordinata, `null` se è il primo. */
export function anchorBefore(ordered: readonly { id: string }[], id: string): string | null {
  const index = ordered.findIndex((item) => item.id === id);
  if (index <= 0) return null;
  return ordered[index - 1]!.id;
}
