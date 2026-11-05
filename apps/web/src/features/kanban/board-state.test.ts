import type { BoardDetailResponse, Card, Column } from '@meet-roulette/schemas';
import { describe, expect, it } from 'vitest';
import {
  appendCard,
  applyCardMove,
  applyColumnMove,
  groupCards,
  menuMove,
  removeCard,
} from './board-state';

const column = (id: string, position: number, over: Partial<Column> = {}): Column => ({
  id,
  boardId: 'b',
  name: id,
  color: null,
  category: null,
  position,
  cardCount: 0,
  archivedCount: 0,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});
const card = (id: string, columnId: string, position: number): Card => ({
  id,
  boardId: 'b',
  columnId,
  title: id,
  description: null,
  priority: 'none',
  position,
  company: null,
  sourceUrl: null,
  createdAt: 1,
  updatedAt: 1,
  archivedAt: null,
});
const data = (): BoardDetailResponse => ({
  board: {
    id: 'b',
    name: 'B',
    description: null,
    icon: null,
    color: null,
    position: 1,
    isFavorite: false,
    createdAt: 1,
    updatedAt: 1,
  },
  columns: [column('c1', 1024, { cardCount: 3 }), column('c2', 2048, { cardCount: 1 })],
  cards: [
    card('a', 'c1', 1024),
    card('b', 'c1', 2048),
    card('c', 'c1', 3072),
    card('x', 'c2', 1024),
  ],
});
const titles = (d: BoardDetailResponse, col: string) =>
  groupCards(d.columns, d.cards)[col]!.map((c) => c.id);

describe('applyCardMove', () => {
  it('riordina nella stessa colonna', () => {
    const next = applyCardMove(data(), { cardId: 'c', columnId: 'c1', afterCardId: null })!;
    expect(titles(next, 'c1')).toEqual(['c', 'a', 'b']);
  });

  it('sposta tra colonne e aggiorna i contatori', () => {
    const next = applyCardMove(data(), { cardId: 'a', columnId: 'c2', afterCardId: 'x' })!;
    expect(titles(next, 'c1')).toEqual(['b', 'c']);
    expect(titles(next, 'c2')).toEqual(['x', 'a']);
    expect(next.columns.map((c) => c.cardCount)).toEqual([2, 2]);
    expect(next.cards.find((c) => c.id === 'a')!.columnId).toBe('c2');
  });

  it('non muta lo stato di partenza (serve per il rollback)', () => {
    const before = data();
    const snapshot = structuredClone(before);
    applyCardMove(before, { cardId: 'a', columnId: 'c2', afterCardId: null });
    expect(before).toEqual(snapshot);
  });

  it('ancora inesistente o scheda inesistente: nessuna modifica locale', () => {
    expect(applyCardMove(data(), { cardId: 'a', columnId: 'c2', afterCardId: 'zzz' })).toBeNull();
    expect(applyCardMove(data(), { cardId: 'nope', columnId: 'c2', afterCardId: null })).toBeNull();
    expect(applyCardMove(data(), { cardId: 'a', columnId: 'c1', afterCardId: 'a' })).toBeNull();
  });

  it('colonna vuota di destinazione', () => {
    const d = data();
    d.columns.push(column('c3', 3072));
    const next = applyCardMove(d, { cardId: 'a', columnId: 'c3', afterCardId: null })!;
    expect(titles(next, 'c3')).toEqual(['a']);
  });
});

describe('applyColumnMove', () => {
  it('riordina le colonne', () => {
    const next = applyColumnMove(data(), { columnId: 'c2', afterColumnId: null })!;
    expect(next.columns.map((c) => c.id)).toEqual(['c2', 'c1']);
  });
});

describe('creazione e archiviazione', () => {
  it('appendCard aggiunge una sola volta e aggiorna il contatore', () => {
    const d = appendCard(data(), card('n', 'c2', 2048));
    expect(titles(d, 'c2')).toEqual(['x', 'n']);
    expect(d.columns[1]!.cardCount).toBe(2);
    expect(appendCard(d, card('n', 'c2', 2048)).cards).toHaveLength(d.cards.length);
  });

  it('removeCard toglie la scheda e conta l’archiviata', () => {
    const d = removeCard(data(), 'a');
    expect(titles(d, 'c1')).toEqual(['b', 'c']);
    expect(d.columns[0]).toMatchObject({ cardCount: 2, archivedCount: 1 });
  });
});

describe('menuMove (alternativa al trascinamento)', () => {
  const groups = groupCards(data().columns, data().cards);
  const cardOf = (id: string) => data().cards.find((c) => c.id === id)!;

  it('su e giù', () => {
    expect(menuMove(groups, cardOf('c'), { kind: 'up' })).toEqual({
      cardId: 'c',
      columnId: 'c1',
      afterCardId: 'a',
    });
    expect(menuMove(groups, cardOf('b'), { kind: 'up' })).toEqual({
      cardId: 'b',
      columnId: 'c1',
      afterCardId: null,
    });
    expect(menuMove(groups, cardOf('a'), { kind: 'down' })).toEqual({
      cardId: 'a',
      columnId: 'c1',
      afterCardId: 'b',
    });
  });
  it('ai bordi non c’è nulla da fare', () => {
    expect(menuMove(groups, cardOf('a'), { kind: 'up' })).toBeNull();
    expect(menuMove(groups, cardOf('c'), { kind: 'down' })).toBeNull();
  });
  it('verso un’altra colonna: in fondo; verso la stessa: nulla', () => {
    expect(menuMove(groups, cardOf('a'), { kind: 'column', columnId: 'c2' })).toEqual({
      cardId: 'a',
      columnId: 'c2',
      afterCardId: 'x',
    });
    expect(menuMove(groups, cardOf('a'), { kind: 'column', columnId: 'c1' })).toBeNull();
  });
});
