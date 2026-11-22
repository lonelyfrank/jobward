import { schema, type Database } from '@jobward/database';
import { EMPTY_INTERVIEW_SUMMARY, type Card } from '@jobward/schemas';
import { eq, sql } from 'drizzle-orm';

const { cards, applicationDetails, currentApplications } = schema;

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
  seniority: 'seniority',
  deadlineOn: 'deadline_on',
  requirements: 'requirements',
  benefits: 'benefits',
  interest: 'interest',
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
  seniority: applicationDetails.seniority,
  deadlineOn: applicationDetails.deadlineOn,
  requirements: applicationDetails.requirements,
  benefits: applicationDetails.benefits,
  interest: applicationDetails.interest,
  companyId: applicationDetails.companyId,
  // Stato della candidatura CORRENTE (vista `current_applications`): NULL senza candidature.
  applicationId: currentApplications.id,
  applicationCount: sql<number>`coalesce(${currentApplications.sequence}, 0)`,
  appliedOn: currentApplications.appliedOn,
  stage: currentApplications.stage,
  outcome: currentApplications.outcome,
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
): Omit<T, 'labelIds'> & { labelIds: string[]; interviewSummary: Card['interviewSummary'] } {
  let ids: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.labelIds);
    if (Array.isArray(parsed)) ids = parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    ids = [];
  }
  // Il riepilogo dei colloqui si aggiunge dopo, con UNA query per bacheca/pagina (mai per scheda).
  return { ...row, labelIds: ids.sort(), interviewSummary: EMPTY_INTERVIEW_SUMMARY };
}

/** Scheda con i suoi dettagli (1:1, facoltativi) e la candidatura corrente: la base di ogni lettura di schede. */
export const selectCards = (db: Database) =>
  db
    .select(cardSelect)
    .from(cards)
    .leftJoin(applicationDetails, eq(applicationDetails.cardId, cards.id))
    .leftJoin(currentApplications, eq(currentApplications.opportunityId, cards.id));

/** Frammento SQL per le query scritte a mano: unisce la candidatura corrente con alias `ca`. */
export const JOIN_CURRENT_APPLICATION =
  'LEFT JOIN current_applications ca ON ca.opportunity_id = k.id';
