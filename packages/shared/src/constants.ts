/**
 * Vocabolari controllati del dominio.
 *
 * Sono definiti una sola volta qui e riutilizzati da schemi Zod, database,
 * API e interfaccia. Nessun valore è specifico di un settore professionale.
 */

/** Priorità di una scheda o attività. L'ordine dell'array è l'ordine crescente di urgenza. */
export const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

/**
 * Fase semantica del processo di candidatura.
 *
 * È indipendente dalla posizione Kanban: l'utente può chiamare e ordinare le
 * colonne come preferisce, mentre la fase semantica permette statistiche
 * affidabili. Una colonna può dichiarare una fase di default.
 */
export const STAGES = [
  'saved',
  'preparing',
  'applied',
  'in_contact',
  'interviewing',
  'offer',
  'closed',
] as const;
export type Stage = (typeof STAGES)[number];

/** Esito della candidatura. Distinto dalla fase: una candidatura `closed` ha un esito. */
export const OUTCOMES = [
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
  'no_response',
  'offer_declined',
] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const WORK_MODES = ['onsite', 'hybrid', 'remote'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const CONTRACT_TYPES = [
  'permanent',
  'fixed_term',
  'part_time',
  'freelance',
  'internship',
  'apprenticeship',
  'temporary',
  'other',
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const SALARY_PERIODS = ['hour', 'day', 'week', 'month', 'year'] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const CUSTOM_FIELD_TYPES = [
  'text',
  'long_text',
  'number',
  'date',
  'boolean',
  'single_select',
  'multi_select',
  'url',
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const ACTIVITY_EVENT_TYPES = [
  'card_created',
  'card_moved',
  'card_archived',
  'card_restored',
  'stage_changed',
  'priority_changed',
  'application_submitted',
  'contact_logged',
  'task_added',
  'task_completed',
  'application_closed',
] as const;
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

/** Ruoli di membership. In M0 esiste solo `owner`; gli altri sono predisposti per il futuro. */
export const MEMBER_ROLES = ['owner', 'editor', 'viewer'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** Limiti condivisi tra validazione, database e interfaccia. */
export const LIMITS = {
  nameMax: 120,
  titleMax: 200,
  descriptionMax: 10_000,
  shortTextMax: 500,
  urlMax: 2_048,
  /** Dimensione massima del body JSON accettato dall'API, in byte. */
  requestBodyMaxBytes: 64 * 1024,
} as const;
