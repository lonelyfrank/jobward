import {
  ACTIVITY_EVENT_TYPES,
  CONTRACT_TYPES,
  CUSTOM_FIELD_TYPES,
  DOCUMENT_KINDS,
  INTERVIEW_MODALITIES,
  INTERVIEW_RESULTS,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
  MEMBER_ROLES,
  OUTCOMES,
  PRIORITIES,
  TASK_KINDS,
  SALARY_BASES,
  SALARY_PERIODS,
  STAGES,
  WORK_MODES,
} from '@jobward/shared';
import { sql, type SQL } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

/**
 * Convenzioni
 * - ID: UUID testuale generato dall'applicazione (`crypto.randomUUID()`).
 * - Timestamp: interi, millisecondi Unix in UTC. Mai stringhe locali.
 * - Date di calendario (pubblicazione, candidatura): testo `YYYY-MM-DD`.
 * - Multi-tenancy: ogni tabella di dominio porta `workspace_id`, così ogni query
 *   può (e deve) filtrare per tenant senza join.
 * - I vocabolari controllati sono protetti da vincoli CHECK, non solo dai tipi TS.
 * - ISOLAMENTO TRA WORKSPACE NEL DATABASE: ogni riferimento a una riga di un altro "livello"
 *   (scheda→bacheca, scheda→colonna, dettagli→scheda, …) usa una chiave esterna COMPOSITA che
 *   include `workspace_id`. Il database rifiuta quindi qualunque riga che punti a una risorsa
 *   di un altro workspace, anche se l'ID esiste. I riferimenti facoltativi con SET NULL
 *   (activity_events) e la coerenza scheda↔campo sono invece garantiti da TRIGGER, definiti
 *   solo nella migrazione SQL (drizzle non li modella): vedi migrations/0001_*.sql.
 */

const id = () => text('id').primaryKey();
const createdAt = () => integer('created_at').notNull();
const updatedAt = () => integer('updated_at').notNull();

/** `col IN ('a','b',...)` costruito da costanti del codice, mai da input utente. */
function inList(column: AnySQLiteColumn, values: readonly string[]): SQL {
  const literals = values.map((v) => sql.raw(`'${v.replaceAll("'", "''")}'`));
  return sql`${column} in (${sql.join(literals, sql`, `)})`;
}

// ---------------------------------------------------------------------------
// Identità e tenancy
// ---------------------------------------------------------------------------

export const users = sqliteTable(
  'users',
  {
    id: id(),
    /** Sempre in minuscolo. */
    email: text('email').notNull(),
    displayName: text('display_name'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    check('users_email_lower', sql`${t.email} = lower(${t.email})`),
  ],
);

export const workspaces = sqliteTable('workspaces', {
  id: id(),
  name: text('name').notNull(),
  /** Fuso orario IANA usato per mostrare scadenze e calcolare "oggi". */
  timezone: text('timezone').notNull().default('UTC'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Membership: predispone permessi articolati. In M0 esiste soltanto il ruolo `owner`. */
export const workspaceMembers = sqliteTable(
  'workspace_members',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: MEMBER_ROLES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    index('workspace_members_user_idx').on(t.userId),
    check('workspace_members_role_valid', inList(t.role, MEMBER_ROLES)),
  ],
);

// ---------------------------------------------------------------------------
// Bacheche
// ---------------------------------------------------------------------------

export const boards = sqliteTable(
  'boards',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),
    color: text('color'),
    position: integer('position').notNull().default(0),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('boards_workspace_position_idx').on(t.workspaceId, t.position),
    // Bersaglio delle chiavi esterne composite dei figli.
    uniqueIndex('boards_id_workspace_unique').on(t.id, t.workspaceId),
  ],
);

export const boardColumns = sqliteTable(
  'board_columns',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    boardId: text('board_id').notNull(),
    name: text('name').notNull(),
    color: text('color'),
    position: integer('position').notNull(),
    /** Fase semantica di default della colonna (facoltativa). */
    category: text('category', { enum: STAGES }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: 'board_columns_board_fk',
      columns: [t.boardId, t.workspaceId],
      foreignColumns: [boards.id, boards.workspaceId],
    }).onDelete('cascade'),
    index('board_columns_board_position_idx').on(t.boardId, t.position),
    // Bersaglio della chiave composita di cards (colonna ⇒ stessa bacheca e stesso workspace).
    uniqueIndex('board_columns_id_board_workspace_unique').on(t.id, t.boardId, t.workspaceId),
    check(
      'board_columns_category_valid',
      sql`${t.category} is null or ${inList(t.category, STAGES)}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Schede
// ---------------------------------------------------------------------------

export const cards = sqliteTable(
  'cards',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    boardId: text('board_id').notNull(),
    columnId: text('column_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    position: integer('position').notNull(),
    priority: text('priority', { enum: PRIORITIES }).notNull().default('none'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    /** Archiviazione recuperabile: la riga non viene cancellata. */
    archivedAt: integer('archived_at'),
  },
  (t) => [
    foreignKey({
      name: 'cards_board_fk',
      columns: [t.boardId, t.workspaceId],
      foreignColumns: [boards.id, boards.workspaceId],
    }).onDelete('cascade'),
    // La colonna deve appartenere alla STESSA bacheca e allo STESSO workspace della scheda.
    // NO ACTION (verificata a fine istruzione), non RESTRICT: una colonna con schede non può
    // essere eliminata da sola, ma eliminare l'intera bacheca/workspace (che rimuove colonne
    // e schede nella stessa istruzione) riesce senza dipendere dall'ordine interno delle cascade.
    foreignKey({
      name: 'cards_column_fk',
      columns: [t.columnId, t.boardId, t.workspaceId],
      foreignColumns: [boardColumns.id, boardColumns.boardId, boardColumns.workspaceId],
    }).onDelete('no action'),
    index('cards_column_position_idx').on(t.columnId, t.position),
    index('cards_workspace_archived_idx').on(t.workspaceId, t.archivedAt),
    index('cards_board_idx').on(t.boardId),
    // Ordinamento predefinito di ricerca e tabella ("ultima modifica"), per workspace (0003).
    index('cards_workspace_updated_idx').on(t.workspaceId, t.updatedAt),
    uniqueIndex('cards_id_workspace_unique').on(t.id, t.workspaceId),
    check('cards_priority_valid', inList(t.priority, PRIORITIES)),
  ],
);

/** Informazioni strutturate dell'opportunità. 1:1 con la scheda, tutti i campi facoltativi. */
export const applicationDetails = sqliteTable(
  'application_details',
  {
    cardId: text('card_id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    company: text('company'),
    position: text('position'),
    location: text('location'),
    workMode: text('work_mode', { enum: WORK_MODES }),
    contractType: text('contract_type', { enum: CONTRACT_TYPES }),
    /** Importi in unità intere della valuta (non in centesimi). */
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    currency: text('currency'),
    salaryPeriod: text('salary_period', { enum: SALARY_PERIODS }),
    /** Lordo o netto. NULL = non specificato (aggiunta in 0003): non va mai dedotto. */
    salaryBasis: text('salary_basis', { enum: SALARY_BASES }),
    source: text('source'),
    sourceUrl: text('source_url'),
    publishedOn: text('published_on'),
    appliedOn: text('applied_on'),
    /** Fase semantica: indipendente dalla colonna Kanban. */
    stage: text('stage', { enum: STAGES }),
    /** Esito: indipendente dalla fase. */
    outcome: text('outcome', { enum: OUTCOMES }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: 'application_details_card_fk',
      columns: [t.cardId, t.workspaceId],
      foreignColumns: [cards.id, cards.workspaceId],
    }).onDelete('cascade'),
    index('application_details_workspace_stage_idx').on(t.workspaceId, t.stage),
    check(
      'application_details_work_mode_valid',
      sql`${t.workMode} is null or ${inList(t.workMode, WORK_MODES)}`,
    ),
    check(
      'application_details_contract_valid',
      sql`${t.contractType} is null or ${inList(t.contractType, CONTRACT_TYPES)}`,
    ),
    check(
      'application_details_period_valid',
      sql`${t.salaryPeriod} is null or ${inList(t.salaryPeriod, SALARY_PERIODS)}`,
    ),
    check('application_details_stage_valid', sql`${t.stage} is null or ${inList(t.stage, STAGES)}`),
    check(
      'application_details_outcome_valid',
      sql`${t.outcome} is null or ${inList(t.outcome, OUTCOMES)}`,
    ),
    check(
      'application_details_basis_valid',
      sql`${t.salaryBasis} is null or ${inList(t.salaryBasis, SALARY_BASES)}`,
    ),
    check(
      'application_details_salary_range',
      sql`${t.salaryMin} is null or ${t.salaryMax} is null or ${t.salaryMin} <= ${t.salaryMax}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Personalizzazione
// ---------------------------------------------------------------------------

export const customFieldDefinitions = sqliteTable(
  'custom_field_definitions',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    boardId: text('board_id').notNull(),
    name: text('name').notNull(),
    type: text('type', { enum: CUSTOM_FIELD_TYPES }).notNull(),
    /** JSON validato da `customFieldDefinitionInput` (opzioni, limiti, ...). */
    config: text('config').notNull().default('{}'),
    position: integer('position').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: 'custom_field_definitions_board_fk',
      columns: [t.boardId, t.workspaceId],
      foreignColumns: [boards.id, boards.workspaceId],
    }).onDelete('cascade'),
    index('custom_field_definitions_board_idx').on(t.boardId, t.position),
    // Nome univoco nella bacheca, senza distinzione di maiuscole (0003; la tabella era inutilizzata).
    uniqueIndex('custom_field_definitions_board_name_unique').on(t.boardId, sql`lower(${t.name})`),
    uniqueIndex('custom_field_definitions_id_workspace_unique').on(t.id, t.workspaceId),
    check('custom_field_definitions_type_valid', inList(t.type, CUSTOM_FIELD_TYPES)),
  ],
);

export const customFieldValues = sqliteTable(
  'custom_field_values',
  {
    cardId: text('card_id').notNull(),
    fieldId: text('field_id').notNull(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Valore serializzato in JSON: preserva numeri, booleani e array. */
    value: text('value').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.cardId, t.fieldId] }),
    foreignKey({
      name: 'custom_field_values_card_fk',
      columns: [t.cardId, t.workspaceId],
      foreignColumns: [cards.id, cards.workspaceId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'custom_field_values_field_fk',
      columns: [t.fieldId, t.workspaceId],
      foreignColumns: [customFieldDefinitions.id, customFieldDefinitions.workspaceId],
    }).onDelete('cascade'),
    index('custom_field_values_field_idx').on(t.fieldId),
  ],
);

export const labels = sqliteTable(
  'labels',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('slate'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('labels_workspace_name_unique').on(t.workspaceId, sql`lower(${t.name})`),
    uniqueIndex('labels_id_workspace_unique').on(t.id, t.workspaceId),
  ],
);

export const cardLabels = sqliteTable(
  'card_labels',
  {
    cardId: text('card_id').notNull(),
    labelId: text('label_id').notNull(),
    /** Aggiunta in 0001: scheda ed etichetta devono appartenere allo stesso workspace. */
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.cardId, t.labelId] }),
    foreignKey({
      name: 'card_labels_card_fk',
      columns: [t.cardId, t.workspaceId],
      foreignColumns: [cards.id, cards.workspaceId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'card_labels_label_fk',
      columns: [t.labelId, t.workspaceId],
      foreignColumns: [labels.id, labels.workspaceId],
    }).onDelete('cascade'),
    index('card_labels_label_idx').on(t.labelId),
  ],
);

// ---------------------------------------------------------------------------
// Colloqui (M2.5)
// ---------------------------------------------------------------------------

/**
 * Un round di selezione di una candidatura. Entità dedicata (non un campo personalizzato).
 * - `sequence` è stabile (1, 2, 3…) e univoco per scheda; non si riusa perché i round non si eliminano
 *   (si annullano) e sopravvivono all'archiviazione della scheda.
 * - STATO organizzativo (`status`) ed ESITO (`result`) sono separati: l'esito esiste solo se completato.
 * - `scheduled_at` è un istante UTC (ms); `timezone` è il fuso IANA in cui l'utente lo ha inserito.
 * - Chiave composita (scheda, workspace): un round non può puntare a una scheda di un altro workspace.
 */
export const interviews = sqliteTable(
  'interviews',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    cardId: text('card_id').notNull(),
    sequence: integer('sequence').notNull(),
    title: text('title').notNull(),
    type: text('type', { enum: INTERVIEW_TYPES }).notNull().default('other'),
    status: text('status', { enum: INTERVIEW_STATUSES }).notNull().default('to_schedule'),
    scheduledAt: integer('scheduled_at'),
    timezone: text('timezone'),
    durationMinutes: integer('duration_minutes'),
    modality: text('modality', { enum: INTERVIEW_MODALITIES }),
    location: text('location'),
    meetingUrl: text('meeting_url'),
    /** Elenco JSON di nomi (≤ 10): dato leggero, non un'entità. */
    interviewers: text('interviewers').notNull().default('[]'),
    preparationNotes: text('preparation_notes'),
    feedbackNotes: text('feedback_notes'),
    result: text('result', { enum: INTERVIEW_RESULTS }),
    completedAt: integer('completed_at'),
    /** SHA-256 della richiesta di creazione (0005); NULL per i round precedenti a M3-C2. */
    requestFingerprint: text('request_fingerprint'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: 'interviews_card_fk',
      columns: [t.cardId, t.workspaceId],
      foreignColumns: [cards.id, cards.workspaceId],
    }).onDelete('cascade'),
    uniqueIndex('interviews_card_sequence_unique').on(t.cardId, t.sequence),
    uniqueIndex('interviews_id_workspace_unique').on(t.id, t.workspaceId),
    // Prossimo colloquio / azioni in sospeso per workspace.
    index('interviews_workspace_status_idx').on(t.workspaceId, t.status, t.scheduledAt),
    check('interviews_sequence_positive', sql`${t.sequence} >= 1`),
    check('interviews_type_valid', inList(t.type, INTERVIEW_TYPES)),
    check('interviews_status_valid', inList(t.status, INTERVIEW_STATUSES)),
    check(
      'interviews_modality_valid',
      sql`${t.modality} is null or ${inList(t.modality, INTERVIEW_MODALITIES)}`,
    ),
    check(
      'interviews_result_valid',
      sql`${t.result} is null or ${inList(t.result, INTERVIEW_RESULTS)}`,
    ),
    check(
      'interviews_duration_valid',
      sql`${t.durationMinutes} is null or ${t.durationMinutes} between 1 and 1440`,
    ),
    // L'esito appartiene a un colloquio concluso; un colloquio "programmato" ha una data;
    // la data di completamento c'è se e solo se è completato.
    check(
      'interviews_result_needs_completed',
      sql`${t.result} is null or ${t.status} = 'completed'`,
    ),
    check(
      'interviews_scheduled_has_date',
      sql`${t.status} <> 'scheduled' or ${t.scheduledAt} is not null`,
    ),
    check(
      'interviews_completed_at_matches',
      sql`(${t.status} = 'completed') = (${t.completedAt} is not null)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Note e riferimenti documentali (M3-C2)
// ---------------------------------------------------------------------------

/**
 * Nota manuale di una candidatura. Il testo vive SOLO qui (la cronologia di sistema non lo copia).
 * - L'ID è generato dal client all'apertura del modulo: è la chiave di idempotenza della creazione.
 * - `request_fingerprint` (SHA-256 della richiesta originale normalizzata) non cambia mai: un replay
 *   si confronta con quello, non con la versione corrente della nota.
 * - L'eliminazione lascia una LAPIDE (`deleted_at`, testo e fingerprint azzerati): un retry tardivo
 *   della creazione non può ricreare una nota eliminata. Le lapidi non contano per il tetto.
 */
export const cardNotes = sqliteTable(
  'card_notes',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    cardId: text('card_id').notNull(),
    body: text('body').notNull(),
    requestFingerprint: text('request_fingerprint'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: integer('deleted_at'),
  },
  (t) => [
    foreignKey({
      name: 'card_notes_card_fk',
      columns: [t.cardId, t.workspaceId],
      foreignColumns: [cards.id, cards.workspaceId],
    }).onDelete('cascade'),
    uniqueIndex('card_notes_id_workspace_unique').on(t.id, t.workspaceId),
    index('card_notes_card_created_idx').on(t.cardId, t.createdAt, t.id),
    check(
      'card_notes_body_valid',
      sql`${t.deletedAt} is not null or length(${t.body}) between 1 and 10000`,
    ),
    check(
      'card_notes_fingerprint_valid',
      sql`(${t.deletedAt} is null and coalesce(length(${t.requestFingerprint}), 0) = 64) or (${t.deletedAt} is not null and ${t.requestFingerprint} is null)`,
    ),
    check('card_notes_tombstone_scrubbed', sql`${t.deletedAt} is null or ${t.body} = ''`),
  ],
);

/**
 * Riferimento a un documento (CV, lettera, annuncio, portfolio): titolo, tipo, URL http(s)
 * facoltativo e nota. Nessun file, nessun fetch dell'URL. Stesse regole di idempotenza e di lapide
 * delle note.
 */
export const cardDocuments = sqliteTable(
  'card_documents',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    cardId: text('card_id').notNull(),
    title: text('title').notNull(),
    kind: text('kind', { enum: DOCUMENT_KINDS }).notNull().default('other'),
    url: text('url'),
    note: text('note'),
    requestFingerprint: text('request_fingerprint'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: integer('deleted_at'),
  },
  (t) => [
    foreignKey({
      name: 'card_documents_card_fk',
      columns: [t.cardId, t.workspaceId],
      foreignColumns: [cards.id, cards.workspaceId],
    }).onDelete('cascade'),
    uniqueIndex('card_documents_id_workspace_unique').on(t.id, t.workspaceId),
    index('card_documents_card_created_idx').on(t.cardId, t.createdAt, t.id),
    check('card_documents_kind_valid', inList(t.kind, DOCUMENT_KINDS)),
    check(
      'card_documents_title_valid',
      sql`${t.deletedAt} is not null or length(${t.title}) between 1 and 200`,
    ),
    check(
      'card_documents_url_valid',
      sql`${t.url} is null or ${t.url} like 'http://%' or ${t.url} like 'https://%'`,
    ),
    check(
      'card_documents_fingerprint_valid',
      sql`(${t.deletedAt} is null and coalesce(length(${t.requestFingerprint}), 0) = 64) or (${t.deletedAt} is not null and ${t.requestFingerprint} is null)`,
    ),
    check(
      'card_documents_tombstone_scrubbed',
      sql`${t.deletedAt} is null or (${t.title} = '' and ${t.url} is null and ${t.note} is null)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Attività e cronologia
// ---------------------------------------------------------------------------

export const tasks = sqliteTable(
  'tasks',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Null = attività del workspace, non legata a una scheda. */
    cardId: text('card_id'),
    title: text('title').notNull(),
    description: text('description'),
    /** Istante assoluto (ms UTC); viene mostrato nel fuso orario del workspace. */
    dueAt: integer('due_at'),
    /** Null = non completata. */
    completedAt: integer('completed_at'),
    priority: text('priority', { enum: PRIORITIES }).notNull().default('none'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // --- 0006 (M3 Tasks), solo colonne additive ---
    /** Tipo semantico: un follow-up è una task con `kind = 'follow_up'`, non un'entità separata. */
    kind: text('kind', { enum: TASK_KINDS }).notNull().default('general'),
    /**
     * Scadenza come DATA di calendario `YYYY-MM-DD` nel fuso del workspace (nessun orario).
     * `due_at` è LEGACY: non più letta né scritta (nessuna ricostruzione per rimuoverla).
     */
    dueOn: text('due_on'),
    /** Annullata = `cancelled_at` valorizzato. Stato DERIVATO: completed_at / cancelled_at. */
    cancelledAt: integer('cancelled_at'),
    /** SHA-256 della richiesta di creazione (idempotenza); NULL per le righe preesistenti. */
    requestFingerprint: text('request_fingerprint'),
  },
  (t) => [
    // card_id NULL = attività del workspace: con chiave composita NULL la FK non si applica.
    foreignKey({
      name: 'tasks_card_fk',
      columns: [t.cardId, t.workspaceId],
      foreignColumns: [cards.id, cards.workspaceId],
    }).onDelete('cascade'),
    index('tasks_open_due_idx')
      .on(t.workspaceId, t.dueOn, t.id)
      .where(sql`${t.completedAt} is null and ${t.cancelledAt} is null`),
    index('tasks_done_idx')
      .on(t.workspaceId, t.completedAt, t.id)
      .where(sql`${t.completedAt} is not null`),
    index('tasks_card_idx').on(t.cardId),
    check('tasks_priority_valid', inList(t.priority, PRIORITIES)),
    check('tasks_kind_valid', inList(t.kind, TASK_KINDS)),
    check('tasks_title_valid', sql`length(${t.title}) between 1 and 200`),
    check(
      'tasks_description_valid',
      sql`${t.description} is null or length(${t.description}) <= 2000`,
    ),
    check(
      'tasks_not_done_and_cancelled',
      sql`${t.completedAt} is null or ${t.cancelledAt} is null`,
    ),
    check(
      'tasks_due_on_valid',
      sql`${t.dueOn} is null or (${t.dueOn} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' and date(${t.dueOn}) is ${t.dueOn})`,
    ),
    check(
      'tasks_fingerprint_valid',
      sql`${t.requestFingerprint} is null or length(${t.requestFingerprint}) = 64`,
    ),
  ],
);

/**
 * Cronologia degli eventi significativi. `metadata` contiene solo dati strutturati
 * minimi (es. colonna di origine/destinazione), mai testo libero riservato.
 */
export const activityEvents = sqliteTable(
  'activity_events',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    boardId: text('board_id').references(() => boards.id, { onDelete: 'set null' }),
    cardId: text('card_id').references(() => cards.id, { onDelete: 'set null' }),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    type: text('type', { enum: ACTIVITY_EVENT_TYPES }).notNull(),
    metadata: text('metadata').notNull().default('{}'),
    occurredAt: integer('occurred_at').notNull(),
    /**
     * Idempotenza (0005). `dedupe_key` = JSON `[tipo, entità, id entità, id operazione]`, univoca per
     * workspace: un retry non può registrare due volte lo stesso evento. NULL per gli eventi
     * preesistenti e per quelli che non nascono da un'operazione con ID stabile.
     */
    dedupeKey: text('dedupe_key'),
    /** ID stabile dell'operazione del client che ha prodotto l'evento (transizione, creazione). */
    operationId: text('operation_id'),
    /** SHA-256 della richiesta originale normalizzata: immutabile, mai testo riservato. */
    requestFingerprint: text('request_fingerprint'),
  },
  (t) => [
    index('activity_events_workspace_time_idx').on(t.workspaceId, t.occurredAt),
    index('activity_events_card_time_idx').on(t.cardId, t.occurredAt),
    uniqueIndex('activity_events_dedupe_unique')
      .on(t.workspaceId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
    index('activity_events_operation_idx')
      .on(t.workspaceId, t.operationId)
      .where(sql`${t.operationId} is not null`),
    check('activity_events_type_valid', inList(t.type, ACTIVITY_EVENT_TYPES)),
    check(
      'activity_events_operation_consistent',
      sql`(${t.operationId} is null) = (${t.requestFingerprint} is null)`,
    ),
    check(
      'activity_events_dedupe_needs_operation',
      sql`${t.dedupeKey} is null or ${t.operationId} is not null`,
    ),
  ],
);
