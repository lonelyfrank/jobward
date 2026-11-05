import type { BoardDetailResponse, BoardListItem, Card, Column } from '@meet-roulette/schemas';

export const board = (over: Partial<BoardListItem> = {}): BoardListItem => ({
  id: 'b1',
  name: 'Ricerca autunno',
  description: null,
  icon: null,
  color: null,
  position: 1024,
  isFavorite: false,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  columnCount: 3,
  cardCount: 2,
  ...over,
});

export const column = (
  id: string,
  name: string,
  position: number,
  over: Partial<Column> = {},
): Column => ({
  id,
  boardId: 'b1',
  name,
  color: null,
  category: null,
  position,
  cardCount: 0,
  archivedCount: 0,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

export const card = (
  id: string,
  title: string,
  columnId: string,
  position: number,
  over: Partial<Card> = {},
): Card => ({
  id,
  boardId: 'b1',
  columnId,
  title,
  description: null,
  priority: 'none',
  position,
  company: null,
  jobTitle: null,
  location: null,
  workMode: null,
  contractType: null,
  salaryMin: null,
  salaryMax: null,
  currency: null,
  salaryPeriod: null,
  salaryBasis: null,
  source: null,
  sourceUrl: null,
  publishedOn: null,
  appliedOn: null,
  stage: null,
  outcome: null,
  labelIds: [],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  archivedAt: null,
  ...over,
});

/** Bacheca con tre colonne e due schede in "Salvate". */
export function boardDetail(): BoardDetailResponse {
  return {
    board: {
      id: 'b1',
      name: 'Ricerca autunno',
      description: 'Offerte di lavoro per l’autunno',
      icon: null,
      color: 'blue',
      position: 1024,
      isFavorite: false,
      createdAt: 1,
      updatedAt: 1,
    },
    columns: [
      column('c1', 'Salvate', 1024, { cardCount: 2, category: 'saved' }),
      column('c2', 'Inviate', 2048),
      column('c3', 'Colloquio', 3072),
    ],
    cards: [
      card('k1', 'Barista part-time', 'c1', 1024, { priority: 'high', company: 'Caffè Roma' }),
      card('k2', 'Magazziniere', 'c1', 2048),
    ],
  };
}
