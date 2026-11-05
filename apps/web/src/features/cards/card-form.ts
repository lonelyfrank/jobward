import {
  salaryIssues,
  updateCardInput,
  type Card,
  type UpdateCardInput,
} from '@jobward/schemas';
import type { Priority } from '@jobward/shared';

/**
 * Bozza del modulo di dettaglio: ogni controllo lavora con TESTO (anche numeri e menu, dove
 * la stringa vuota significa "nessun valore"). Funzioni pure, testate senza interfaccia.
 */
export interface CardDraft {
  title: string;
  description: string;
  priority: Priority;
  company: string;
  jobTitle: string;
  location: string;
  workMode: string;
  contractType: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  salaryPeriod: string;
  salaryBasis: string;
  source: string;
  sourceUrl: string;
  publishedOn: string;
  appliedOn: string;
  stage: string;
  outcome: string;
}

export type DraftKey = keyof CardDraft;

const text = (value: string | null) => value ?? '';
const amount = (value: number | null) => (value === null ? '' : String(value));

export function draftFromCard(card: Card): CardDraft {
  return {
    title: card.title,
    description: text(card.description),
    priority: card.priority,
    company: text(card.company),
    jobTitle: text(card.jobTitle),
    location: text(card.location),
    workMode: text(card.workMode),
    contractType: text(card.contractType),
    salaryMin: amount(card.salaryMin),
    salaryMax: amount(card.salaryMax),
    currency: text(card.currency),
    salaryPeriod: text(card.salaryPeriod),
    salaryBasis: text(card.salaryBasis),
    source: text(card.source),
    sourceUrl: text(card.sourceUrl),
    publishedOn: text(card.publishedOn),
    appliedOn: text(card.appliedOn),
    stage: text(card.stage),
    outcome: text(card.outcome),
  };
}

const nullable = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** Importo intero da testo: `undefined` se non è un numero intero non negativo. */
function parseAmount(value: string): number | null | undefined {
  const trimmed = value.trim().replace(/\s/g, '');
  if (trimmed === '') return null;
  // Accetta "1800" e "1.800" (separatore delle migliaia all'italiana); non decimali né esponenti.
  const normalized = /^\d{1,3}(\.\d{3})+$/.test(trimmed) ? trimmed.replaceAll('.', '') : trimmed;
  return /^\d+$/.test(normalized) ? Number(normalized) : undefined;
}

export type DraftErrors = Partial<Record<DraftKey, string>>;

/** Valore tipizzato di ogni campo, nel formato atteso dal contratto (`null` = nessun valore). */
function typedValues(draft: CardDraft, errors: DraftErrors) {
  const salaryMin = parseAmount(draft.salaryMin);
  const salaryMax = parseAmount(draft.salaryMax);
  if (salaryMin === undefined) errors.salaryMin = 'Inserisci un importo intero (es. 1800)';
  if (salaryMax === undefined) errors.salaryMax = 'Inserisci un importo intero (es. 2200)';
  return {
    title: draft.title.trim(),
    description: nullable(draft.description),
    priority: draft.priority,
    company: nullable(draft.company),
    jobTitle: nullable(draft.jobTitle),
    location: nullable(draft.location),
    workMode: nullable(draft.workMode),
    contractType: nullable(draft.contractType),
    salaryMin: salaryMin ?? null,
    salaryMax: salaryMax ?? null,
    currency: nullable(draft.currency)?.toUpperCase() ?? null,
    salaryPeriod: nullable(draft.salaryPeriod),
    salaryBasis: nullable(draft.salaryBasis),
    source: nullable(draft.source),
    sourceUrl: nullable(draft.sourceUrl),
    publishedOn: nullable(draft.publishedOn),
    appliedOn: nullable(draft.appliedOn),
    stage: nullable(draft.stage),
    outcome: nullable(draft.outcome),
  };
}

const KEYS = [
  'title',
  'description',
  'priority',
  'company',
  'jobTitle',
  'location',
  'workMode',
  'contractType',
  'salaryMin',
  'salaryMax',
  'currency',
  'salaryPeriod',
  'salaryBasis',
  'source',
  'sourceUrl',
  'publishedOn',
  'appliedOn',
  'stage',
  'outcome',
] as const;

export interface BuiltChanges {
  /** Solo i campi diversi dalla scheda salvata (nessuna sovrascrittura del resto). */
  changes: Record<string, unknown>;
  /** Payload validato dal contratto condiviso, se non ci sono errori. */
  input: UpdateCardInput | null;
  errors: DraftErrors;
}

/**
 * Confronta la bozza con la scheda salvata e costruisce la patch minima. Gli errori sono
 * quelli del contratto condiviso (stessi messaggi del server) più la coerenza della retribuzione
 * sullo stato risultante, così l'utente li vede accanto al campo prima ancora di inviare.
 */
export function buildChanges(draft: CardDraft, card: Card): BuiltChanges {
  const errors: DraftErrors = {};
  const typed = typedValues(draft, errors);
  const saved = draftFromCard(card);
  const savedTyped = typedValues(saved, {});

  const changes: Record<string, unknown> = {};
  for (const key of KEYS) {
    if (typed[key] !== savedTyped[key]) changes[key] = typed[key];
  }

  if (Object.keys(changes).length === 0) return { changes, input: null, errors };

  const parsed = updateCardInput.safeParse(changes);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]) as DraftKey;
      if (key in draft) errors[key] ??= issue.message;
    }
  }
  // Stato risultante: l'importo richiede la valuta anche se la patch non la tocca.
  if (
    typed.salaryMin !== savedTyped.salaryMin ||
    typed.salaryMax !== savedTyped.salaryMax ||
    typed.currency !== savedTyped.currency
  ) {
    for (const issue of salaryIssues(typed)) errors[issue.path] ??= issue.message;
  }
  const failed = Object.keys(errors).length > 0;
  return { changes, input: !failed && parsed.success ? parsed.data : null, errors };
}

/** Mappa i `path` degli errori del server (o del contratto) sui campi del modulo. */
export function serverFieldErrors(
  issues: { path: string; message: string }[] | undefined,
): DraftErrors {
  const errors: DraftErrors = {};
  for (const issue of issues ?? []) {
    const key = issue.path.split('.')[0] as DraftKey;
    if ((KEYS as readonly string[]).includes(key)) errors[key] ??= issue.message;
  }
  return errors;
}
