import type {
  ContractType,
  Outcome,
  Priority,
  SalaryBasis,
  SalaryPeriod,
  Stage,
  WorkMode,
} from '@meet-roulette/shared';
import type { ColorToken } from '@meet-roulette/schemas';

/** Testi dell'interfaccia per i vocabolari controllati (i valori restano neutri nel dominio). */
export const PRIORITY_LABELS: Record<Priority, string> = {
  none: 'Nessuna',
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

export const STAGE_LABELS: Record<Stage, string> = {
  saved: 'Salvata',
  preparing: 'In preparazione',
  applied: 'Inviata',
  in_contact: 'In contatto',
  interviewing: 'Colloquio',
  offer: 'Offerta',
  closed: 'Conclusa',
};

export const OUTCOME_LABELS: Record<Outcome, string> = {
  pending: 'In attesa',
  accepted: 'Accettata',
  rejected: 'Rifiutata',
  withdrawn: 'Ritirata',
  no_response: 'Nessuna risposta',
  offer_declined: 'Offerta rifiutata',
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  onsite: 'In presenza',
  hybrid: 'Ibrido',
  remote: 'Da remoto',
};

export const CONTRACT_LABELS: Record<ContractType, string> = {
  permanent: 'Tempo indeterminato',
  fixed_term: 'Tempo determinato',
  part_time: 'Part-time',
  freelance: 'Libera professione',
  internship: 'Tirocinio',
  apprenticeship: 'Apprendistato',
  temporary: 'Somministrazione',
  other: 'Altro',
};

export const PERIOD_LABELS: Record<SalaryPeriod, string> = {
  hour: 'all’ora',
  day: 'al giorno',
  week: 'a settimana',
  month: 'al mese',
  year: 'all’anno',
};

/** `null` (non specificato) non ha un'etichetta: l'interfaccia non deve mai dedurre lordo o netto. */
export const BASIS_LABELS: Record<SalaryBasis, string> = { gross: 'lordo', net: 'netto' };

export const COLOR_LABELS: Record<ColorToken, string> = {
  slate: 'Grigio',
  blue: 'Blu',
  green: 'Verde',
  amber: 'Ambra',
  violet: 'Viola',
  rose: 'Rosa',
  teal: 'Turchese',
  orange: 'Arancione',
};

/** Classi complete (Tailwind le rileva staticamente): un token colore → sfondo del campione. */
export const COLOR_BG: Record<ColorToken, string> = {
  slate: 'bg-accent-slate',
  blue: 'bg-accent-blue',
  green: 'bg-accent-green',
  amber: 'bg-accent-amber',
  violet: 'bg-accent-violet',
  rose: 'bg-accent-rose',
  teal: 'bg-accent-teal',
  orange: 'bg-accent-orange',
};

export const COLOR_BORDER_TOP: Record<ColorToken, string> = {
  slate: 'border-t-accent-slate',
  blue: 'border-t-accent-blue',
  green: 'border-t-accent-green',
  amber: 'border-t-accent-amber',
  violet: 'border-t-accent-violet',
  rose: 'border-t-accent-rose',
  teal: 'border-t-accent-teal',
  orange: 'border-t-accent-orange',
};

export function isColorToken(value: string | null | undefined): value is ColorToken {
  return value != null && value in COLOR_BG;
}
