import { schema, type Database } from '@meet-roulette/database';
import type { Card } from '@meet-roulette/schemas';
import { eq, sql } from 'drizzle-orm';

const { cards, applicationDetails } = schema;

/**
 * Colonne di `application_details` modificabili dall'API, associate alla chiave del contratto.
 * È l'UNICO punto in cui una chiave del payload diventa il nome di una colonna SQL: l'insieme è
 * chiuso e costante, quindi nessun nome di colonna deriva mai da input non validato.
 */
export const DETAIL_COLUMNS = {
  company: 'company',
  jobTitle: 'position',
  location: 'location',
  workMode: 'work_mode',
  contractType: 'contract_type',
  salaryMin: 'salary_min',
  salaryMax: 'salary_max',
  currency: 'currency',
  salaryPeriod: 'salary_period',
  salaryBasis: 'salary_basis',
  source: 'source',
  sourceUrl: 'source_url',
  publishedOn: 'published_on',
  appliedOn: 'applied_on',
  stage: 'stage',
  outcome: 'outcome',
} as const;
export type DetailKey = keyof typeof DETAIL_COLUMNS;
export const DETAIL_KEYS_LIST = Object.keys(DETAIL_COLUMNS) as DetailKey[];

/** Selezione comune a bacheca, dettaglio e ricerca: una scheda ha sempre la stessa forma. */
export const cardSelect = {
  id: cards.id,
  boardId: cards.boardId,
  columnId: cards.columnId,
  title: cards.title,
  description: cards.description,
  priority: cards.priority,
  position: cards.position,
  company: applicationDetails.company,
  jobTitle: applicationDetails.position,
  location: applicationDetails.location,
  workMode: applicationDetails.workMode,
  contractType: applicationDetails.contractType,
  salaryMin: applicationDetails.salaryMin,
  salaryMax: applicationDetails.salaryMax,
  currency: applicationDetails.currency,
  salaryPeriod: applicationDetails.salaryPeriod,
  salaryBasis: applicationDetails.salaryBasis,
  source: applicationDetails.source,
  sourceUrl: applicationDetails.sourceUrl,
  publishedOn: applicationDetails.publishedOn,
  appliedOn: applicationDetails.appliedOn,
  stage: applicationDetails.stage,
  outcome: applicationDetails.outcome,
  /** Array JSON degli ID delle etichette: nessuna seconda query e nessun limite di parametri. */
  labelIds: sql<string>`(select coalesce(json_group_array(cl.label_id), '[]') from card_labels cl where cl.card_id = ${cards.id} and cl.workspace_id = ${cards.workspaceId})`,
  createdAt: cards.createdAt,
  updatedAt: cards.updatedAt,
  archivedAt: cards.archivedAt,
};

export type CardRow = Omit<Card, 'labelIds'> & { labelIds: string };

/** `labelIds` arriva come JSON da SQLite: lo si decodifica e lo si rende ordinato e deterministico. */
export function toCard<T extends { labelIds: string }>(
  row: T,
): Omit<T, 'labelIds'> & { labelIds: string[] } {
  let ids: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.labelIds);
    if (Array.isArray(parsed)) ids = parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    ids = [];
  }
  return { ...row, labelIds: ids.sort() };
}

/** Scheda con i suoi dettagli (1:1, facoltativi): la base di ogni lettura di schede. */
export const selectCards = (db: Database) =>
  db
    .select(cardSelect)
    .from(cards)
    .leftJoin(applicationDetails, eq(applicationDetails.cardId, cards.id));
