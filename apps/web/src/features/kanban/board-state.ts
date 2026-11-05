import type { BoardDetailResponse, Card, Column } from '@jobward/schemas';
import { anchorBefore, applyPlacement, sortPositioned } from '@jobward/shared';

/**
 * Funzioni PURE sullo stato di una bacheca. Il client le usa per l'aggiornamento ottimistico
 * con la stessa logica di posizionamento del server (`@jobward/shared`), così la vista
 * provvisoria coincide con quella che il server confermerà.
 */

/** Schede raggruppate per colonna e ordinate; ogni colonna esiste anche se vuota. */
export function groupCards(columns: readonly Column[], cards: readonly Card[]) {
  const groups: Record<string, Card[]> = {};
  for (const column of columns) groups[column.id] = [];
  for (const card of cards) (groups[card.columnId] ??= []).push(card);
  for (const id of Object.keys(groups)) groups[id] = sortPositioned(groups[id]!);
  return groups;
}

export interface CardMove {
  cardId: string;
  columnId: string;
  /** Scheda che deve precedere quella spostata (`null` = in cima). */
  afterCardId: string | null;
}

function withCounts(columns: Column[], cards: Card[]): Column[] {
  return columns.map((column) => ({
    ...column,
    cardCount: cards.filter((card) => card.columnId === column.id).length,
  }));
}

/** Applica lo spostamento di una scheda. Restituisce `null` se non è applicabile in locale. */
export function applyCardMove(
  data: BoardDetailResponse,
  move: CardMove,
): BoardDetailResponse | null {
  const card = data.cards.find((c) => c.id === move.cardId);
  const target = data.columns.find((c) => c.id === move.columnId);
  if (!card || !target || move.afterCardId === card.id) return null;

  const siblings = data.cards.filter((c) => c.columnId === move.columnId && c.id !== card.id);
  const placed = applyPlacement(siblings, { ...card, columnId: move.columnId }, move.afterCardId);
  if (!placed) return null;

  const others = data.cards.filter((c) => c.columnId !== move.columnId && c.id !== card.id);
  const cards = [...others, ...placed];
  return { ...data, cards, columns: withCounts(data.columns, cards) };
}

export interface ColumnMove {
  columnId: string;
  afterColumnId: string | null;
}

export function applyColumnMove(
  data: BoardDetailResponse,
  move: ColumnMove,
): BoardDetailResponse | null {
  const column = data.columns.find((c) => c.id === move.columnId);
  if (!column || move.afterColumnId === column.id) return null;
  const siblings = data.columns.filter((c) => c.id !== column.id);
  const columns = applyPlacement(siblings, column, move.afterColumnId);
  return columns ? { ...data, columns } : null;
}

/** Aggiunge una scheda appena creata (in fondo alla colonna) senza attendere il ricaricamento. */
export function appendCard(data: BoardDetailResponse, card: Card): BoardDetailResponse {
  if (data.cards.some((c) => c.id === card.id)) return data;
  const cards = [...data.cards, card];
  return { ...data, cards, columns: withCounts(data.columns, cards) };
}

export function replaceCard(data: BoardDetailResponse, card: Card): BoardDetailResponse {
  const cards = data.cards.map((c) => (c.id === card.id ? card : c));
  return { ...data, cards };
}

export function removeCard(data: BoardDetailResponse, cardId: string): BoardDetailResponse {
  const card = data.cards.find((c) => c.id === cardId);
  if (!card) return data;
  const cards = data.cards.filter((c) => c.id !== cardId);
  const columns = withCounts(data.columns, cards).map((column) =>
    column.id === card.columnId ? { ...column, archivedCount: column.archivedCount + 1 } : column,
  );
  return { ...data, cards, columns };
}

/** Il predecessore di una scheda nel suo gruppo ordinato (per costruire lo spostamento). */
export function predecessorOf(group: readonly Card[], cardId: string): string | null {
  return anchorBefore(group, cardId);
}

/**
 * Spostamenti raggiungibili da menu (alternativa al trascinamento):
 * su/giù nella colonna, o in fondo a un'altra colonna.
 */
export function menuMove(
  groups: Record<string, Card[]>,
  card: Card,
  to: { kind: 'up' } | { kind: 'down' } | { kind: 'column'; columnId: string },
): CardMove | null {
  const own = groups[card.columnId] ?? [];
  const index = own.findIndex((c) => c.id === card.id);
  if (to.kind === 'column') {
    if (to.columnId === card.columnId) return null;
    const last = (groups[to.columnId] ?? []).at(-1);
    return { cardId: card.id, columnId: to.columnId, afterCardId: last?.id ?? null };
  }
  if (to.kind === 'up') {
    if (index <= 0) return null;
    return {
      cardId: card.id,
      columnId: card.columnId,
      afterCardId: anchorBefore(own, own[index - 1]!.id),
    };
  }
  const next = own[index + 1];
  if (!next) return null;
  return { cardId: card.id, columnId: card.columnId, afterCardId: next.id };
}
