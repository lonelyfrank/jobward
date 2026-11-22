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

/**
 * Fasi che implicano una candidatura già inviata. Usate dalle statistiche: "Conclusa" da sola non
 * basta (si può chiudere una scheda senza aver mai inviato nulla) e la colonna Kanban non conta.
 */
export const SUBMITTED_STAGES = ['applied', 'in_contact', 'interviewing', 'offer'] as const;

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

/** Livello di esperienza richiesto da un'opportunità (B-02). */
export const SENIORITY_LEVELS = ['intern', 'junior', 'mid', 'senior', 'lead', 'executive'] as const;
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

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

/**
 * Natura dell'importo. Nel database `NULL` significa "non specificato": l'interfaccia non
 * mostra mai una retribuzione come lorda o netta se l'utente non l'ha indicato (M2).
 */
export const SALARY_BASES = ['gross', 'net'] as const;
export type SalaryBasis = (typeof SALARY_BASES)[number];

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
  // M2.5 — colloqui. I metadati non contengono mai note o feedback (solo id, numero del round, date).
  'interview_created',
  'interview_next_round_created',
  'interview_rescheduled',
  'interview_completed',
  'interview_cancelled',
  'interview_feedback_recorded',
  // M3-C2 — riapertura di una candidatura chiusa (migrazione 0005).
  'application_reopened',
  // Dominio Opportunity/Application: creazione di una candidatura; (s)posizionamento in bacheca (predisposti).
  'application_created',
  'card_placed',
  'card_unplaced',
] as const;
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

/**
 * Tipi evento che il database accetta (0010) ma che l'applicazione NON emette ancora e la cronologia NON mostra.
 * L'attivazione (emissione + etichette + test) è una fase successiva: finché un tipo è qui, le letture della
 * cronologia lo escludono (nessuna voce con etichetta non definita, paginazione invariata). Toglierlo da questo
 * elenco è l'atto che lo rende visibile.
 */
export const DORMANT_ACTIVITY_EVENT_TYPES = [
  'card_placed',
  'card_unplaced',
] as const satisfies readonly (typeof ACTIVITY_EVENT_TYPES)[number][];
export type DormantActivityEventType = (typeof DORMANT_ACTIVITY_EVENT_TYPES)[number];
export const isDormantActivityEventType = (type: string): type is DormantActivityEventType =>
  (DORMANT_ACTIVITY_EVENT_TYPES as readonly string[]).includes(type);

/**
 * Contratto dei metadati dei nuovi eventi (0010, D5). JSON strutturato e versionato: `v` è obbligatorio (intero ≥ 1)
 * e il CHECK del database lo impone. Solo identificatori, riferimenti a bacheca/colonna, direzione e motivo
 * strutturato; mai note, descrizioni, nomi di persone, documenti o testo libero. Gli identificatori vivono anche
 * nei metadati perché le colonne `board_id`/`card_id`/`application_id` diventano NULL se l'oggetto viene eliminato:
 * il contesto storico deve sopravvivere alla bacheca (o alla candidatura) eliminata.
 */
export const ACTIVITY_PAYLOAD_VERSION = 1;
export const PLACEMENT_DIRECTIONS = ['placed', 'unplaced'] as const;
export type PlacementDirection = (typeof PLACEMENT_DIRECTIONS)[number];
/** Motivo strutturato di un (s)posizionamento: azione dell'utente, eliminazione della bacheca, trasferimento. */
export const PLACEMENT_REASONS = ['user', 'board_deleted', 'transfer'] as const;
export type PlacementReason = (typeof PLACEMENT_REASONS)[number];

/** Attività (M3 Tasks). Un follow-up è una Task con `kind = 'follow_up'`, non un'entità separata. */
export const TASK_KINDS = ['general', 'follow_up', 'preparation'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];
export const TASK_STATUSES = ['open', 'done', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
/** Viste dell'elenco: «all» = da fare + completate (le annullate hanno una vista propria). */
export const TASK_VIEWS = ['all', 'open', 'done', 'overdue', 'no_due', 'cancelled'] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

/** Riferimenti documentali (M3-C2): si conserva il riferimento, mai il file. */
export const DOCUMENT_KINDS = ['cv', 'cover_letter', 'job_posting', 'portfolio', 'other'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/**
 * Colloqui (M2.5). Tipi neutri rispetto al settore; lo STATO è organizzativo, l'ESITO è un'altra cosa
 * (e vale solo per i colloqui completati).
 */
export const INTERVIEW_TYPES = [
  'screening',
  'technical',
  'behavioral',
  'panel',
  'final',
  'other',
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_STATUSES = ['to_schedule', 'scheduled', 'completed', 'cancelled'] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const INTERVIEW_MODALITIES = ['video', 'phone', 'onsite'] as const;
export type InterviewModality = (typeof INTERVIEW_MODALITIES)[number];

export const INTERVIEW_RESULTS = ['positive', 'neutral', 'negative'] as const;
export type InterviewResult = (typeof INTERVIEW_RESULTS)[number];

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
  /** Tetti per workspace/bacheca: proteggono costi e prestazioni, applicati in modo atomico. */
  boardsPerWorkspaceMax: 100,
  columnsPerBoardMax: 30,
  /** Schede (anche archiviate) per bacheca: la bacheca le carica tutte insieme (ADR-0008). */
  cardsPerBoardMax: 2_000,
  /** Importo retributivo massimo (unità intere della valuta): entro l'intero a 32 bit. */
  salaryAmountMax: 2_000_000_000,
  /** Etichette per workspace e per scheda; campi personalizzati per bacheca (applicati in modo atomico). */
  labelsPerWorkspaceMax: 100,
  labelsPerCardMax: 20,
  labelNameMax: 40,
  customFieldsPerBoardMax: 30,
  customFieldOptionsMax: 100,
  /** Round di colloquio per candidatura (atomico) e persone che conducono un colloquio. */
  interviewsPerCardMax: 50,
  interviewersMax: 10,
  /** Note e riferimenti documentali per candidatura (M3-C2, applicati in modo atomico). */
  notesPerCardMax: 500,
  noteBodyMax: 10_000,
  documentsPerCardMax: 50,
  documentNoteMax: 500,
  /** Pagina della timeline di una candidatura. */
  timelinePageDefault: 25,
  timelinePageMax: 50,
  /** Ricerca: lunghezza del testo, numero di parole e dimensione di pagina. */
  searchTextMax: 100,
  searchTermsMax: 6,
  pageSizeDefault: 25,
  pageSizeMax: 50,
  /** Attività (M3 Tasks): tetti atomici per workspace e dimensione di pagina. */
  taskDescriptionMax: 2_000,
  openTasksPerWorkspaceMax: 500,
  tasksPerWorkspaceMax: 5_000,
  taskPageDefault: 50,
  taskPageMax: 100,
  /** Dimensione massima del body JSON accettato dall'API, in byte. */
  requestBodyMaxBytes: 64 * 1024,
} as const;
