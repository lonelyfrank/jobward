import type {
  ContractType,
  InterviewModality,
  InterviewResult,
  InterviewStatus,
  InterviewType,
  Outcome,
  Priority,
  SalaryBasis,
  SalaryPeriod,
  Stage,
  WorkMode,
} from '@jobward/shared';
import type { ColorToken } from '@jobward/schemas';

/** Testi dell'interfaccia per i vocabolari controllati (i valori restano neutri nel dominio). */
export const PRIORITY_LABELS: Record<Priority, string> = {
  none: 'Nessuna',
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

/** Tono del contrassegno per priorità: stesso significato nel Kanban, nella tabella e nel pannello. */
export const PRIORITY_TONE = {
  none: 'neutral',
  low: 'neutral',
  medium: 'primary',
  high: 'warning',
  urgent: 'danger',
} as const satisfies Record<Priority, 'neutral' | 'primary' | 'warning' | 'danger'>;

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

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  screening: 'Primo contatto / screening',
  technical: 'Tecnico o prova pratica',
  behavioral: 'Conoscitivo / motivazionale',
  panel: 'Commissione o più persone',
  final: 'Finale',
  other: 'Altro',
};

/** Stato ORGANIZZATIVO del round (non l'esito). */
export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  to_schedule: 'Da programmare',
  scheduled: 'Programmato',
  completed: 'Completato',
  cancelled: 'Annullato',
};

export const INTERVIEW_MODALITY_LABELS: Record<InterviewModality, string> = {
  video: 'Videochiamata',
  phone: 'Telefono',
  onsite: 'In presenza',
};

/** Esito del SINGOLO round: indipendente dall'esito della candidatura. */
export const INTERVIEW_RESULT_LABELS: Record<InterviewResult, string> = {
  positive: 'Positivo',
  neutral: 'Neutro',
  negative: 'Negativo',
};
