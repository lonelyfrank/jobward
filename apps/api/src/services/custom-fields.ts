import { newId, type Database } from '@meet-roulette/database';
import {
  createCustomFieldInput,
  customFieldDefinitionInput,
  parseStoredCustomFieldValue,
  serializeCustomFieldValue,
  validateCustomFieldValue,
  valueSchemaFor,
  type CardCustomField,
  type CreateCustomFieldInput,
  type CustomField,
  type CustomFieldDefinitionInput,
  type CustomFieldValue,
  type UpdateCustomFieldInput,
} from '@meet-roulette/schemas';
import { LIMITS, POSITION_GAP } from '@meet-roulette/shared';
import { sql } from 'drizzle-orm';
import { ApiError, conflict, notFound } from '../lib/errors';
import { getBoard } from './boards';
import { getCard } from './cards';
import { decidePlacement, readSiblings, rebalanceStatement } from './ordering';

const isUniqueViolation = (error: unknown) =>
  error instanceof Error &&
  /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(error.message);

const NAME_TAKEN = 'In questa bacheca esiste già un campo con questo nome';

interface FieldRow {
  id: string;
  boardId: string;
  name: string;
  type: string;
  config: string;
  position: number;
  isActive: number;
  valueCount: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Una definizione persistita NON si considera valida perché è JSON: la si rivalida con lo stesso
 * schema usato in ingresso. Una riga corrotta (modifica diretta al database) è un errore del
 * server, non un dato da mostrare.
 */
function toField(row: FieldRow): CustomField {
  let config: unknown;
  try {
    config = JSON.parse(row.config);
  } catch {
    config = null;
  }
  const parsed = customFieldDefinitionInput.safeParse({
    name: row.name,
    type: row.type,
    config,
    isActive: Boolean(row.isActive),
  });
  if (!parsed.success) {
    throw new ApiError(500, 'internal_error', 'Configurazione del campo non valida');
  }
  return {
    ...parsed.data,
    id: row.id,
    boardId: row.boardId,
    position: row.position,
    valueCount: row.valueCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const FIELD_SELECT = sql`
  SELECT f.id AS id, f.board_id AS boardId, f.name AS name, f.type AS type, f.config AS config,
         f.position AS position, f.is_active AS isActive, f.created_at AS createdAt, f.updated_at AS updatedAt,
         (SELECT count(*) FROM custom_field_values v WHERE v.field_id = f.id AND v.workspace_id = f.workspace_id) AS valueCount
  FROM custom_field_definitions f`;

export async function listFields(
  db: Database,
  workspaceId: string,
  boardId: string,
): Promise<CustomField[]> {
  await getBoard(db, workspaceId, boardId);
  const rows = await db.all<FieldRow>(
    sql`${FIELD_SELECT} WHERE f.workspace_id = ${workspaceId} AND f.board_id = ${boardId} ORDER BY f.position, f.id`,
  );
  return rows.map(toField);
}

export async function getField(
  db: Database,
  workspaceId: string,
  fieldId: string,
): Promise<CustomField> {
  const row = await db.get<FieldRow>(
    sql`${FIELD_SELECT} WHERE f.workspace_id = ${workspaceId} AND f.id = ${fieldId}`,
  );
  if (!row) throw notFound('Campo'); // inesistente o di un altro workspace: stessa risposta
  return toField(row);
}

/** Le opzioni nuove ricevono un ID stabile dal server; quelle esistenti lo conservano. */
function withOptionIds(input: CreateCustomFieldInput): CustomFieldDefinitionInput {
  if (input.type === 'single_select' || input.type === 'multi_select') {
    return {
      ...input,
      config: {
        options: input.config.options.map((option) => ({ ...option, id: option.id ?? newId() })),
      },
    };
  }
  return input;
}

function parseDefinition(raw: unknown): CustomFieldDefinitionInput {
  const parsed = createCustomFieldInput.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(
      400,
      'validation_error',
      'Dati non validi',
      parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    );
  }
  const withIds = withOptionIds(parsed.data);
  // Dopo l'assegnazione degli ID la definizione deve superare lo schema "persistito".
  const final = customFieldDefinitionInput.safeParse(withIds);
  if (!final.success) {
    throw new ApiError(400, 'validation_error', 'Dati non validi', [
      { path: 'config', message: final.error.issues[0]?.message ?? 'Configurazione non valida' },
    ]);
  }
  return final.data;
}

// ---------------------------------------------------------------------------
// Definizioni
// ---------------------------------------------------------------------------

export async function createField(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  boardId: string,
  input: CreateCustomFieldInput,
  now: number,
): Promise<CustomField> {
  await getBoard(db, workspaceId, boardId);
  const definition = parseDefinition(input);
  const id = newId();
  let changes: number;
  try {
    const result = await d1
      .prepare(
        `INSERT INTO custom_field_definitions (id, workspace_id, board_id, name, type, config, position, is_active, created_at, updated_at)
         SELECT ?1, b.workspace_id, b.id, ?4, ?5, ?6,
                COALESCE((SELECT max(position) FROM custom_field_definitions WHERE board_id = b.id), 0) + ${POSITION_GAP},
                ?7, ?8, ?8
         FROM boards b
         WHERE b.id = ?2 AND b.workspace_id = ?3
           AND (SELECT count(*) FROM custom_field_definitions WHERE board_id = b.id) < ?9`,
      )
      .bind(
        id,
        boardId,
        workspaceId,
        definition.name,
        definition.type,
        JSON.stringify(definition.config),
        definition.isActive ? 1 : 0,
        now,
        LIMITS.customFieldsPerBoardMax,
      )
      .run();
    changes = result.meta.changes;
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(NAME_TAKEN);
    throw error;
  }
  if (changes !== 1) {
    throw conflict(`Una bacheca può avere al massimo ${LIMITS.customFieldsPerBoardMax} campi`);
  }
  return getField(db, workspaceId, id);
}

/**
 * Modifica di nome, configurazione e stato. Il tipo non cambia mai.
 *
 * Una nuova configurazione è accettata solo se TUTTI i valori già salvati restano validi
 * (opzione rimossa ancora in uso, limite numerico stretto, lunghezza ridotta…): il controllo è
 * generico, rivalida ogni valore con lo schema della nuova definizione. La scrittura è poi
 * condizionata a "nessun valore è cambiato dopo la lettura", quindi una scrittura concorrente
 * non può lasciare un valore incompatibile (in tal caso 409 e si riprova).
 */
export async function updateField(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  fieldId: string,
  input: UpdateCustomFieldInput,
  now: number,
): Promise<CustomField> {
  const current = await getField(db, workspaceId, fieldId);
  const readAt = Date.now();

  let next: CustomFieldDefinitionInput = {
    name: current.name,
    type: current.type,
    config: current.config,
    isActive: current.isActive,
  } as CustomFieldDefinitionInput;
  if (input.name !== undefined) next = { ...next, name: input.name };
  if (input.isActive !== undefined) next = { ...next, isActive: input.isActive };
  if (input.config !== undefined) {
    next = parseDefinition({
      name: next.name,
      type: current.type,
      config: input.config,
      isActive: next.isActive,
    });
  }

  if (input.config !== undefined) {
    const stored = await d1
      .prepare(`SELECT value FROM custom_field_values WHERE field_id = ?1 AND workspace_id = ?2`)
      .bind(fieldId, workspaceId)
      .all<{ value: string }>();
    const schema = valueSchemaFor(next);
    const incompatible = stored.results.filter((row) => {
      try {
        return !schema.safeParse(parseStoredCustomFieldValue(row.value)).success;
      } catch {
        return true;
      }
    }).length;
    if (incompatible > 0) {
      throw conflict(
        `La modifica non è compatibile con i valori già inseriti in ${incompatible} ${incompatible === 1 ? 'scheda' : 'schede'}. Svuota quei valori oppure disattiva il campo.`,
      );
    }
  }

  let changes: number;
  try {
    const result = await d1
      .prepare(
        `UPDATE custom_field_definitions SET name = ?1, config = ?2, is_active = ?3, updated_at = ?4
         WHERE id = ?5 AND workspace_id = ?6
           AND NOT EXISTS (SELECT 1 FROM custom_field_values v WHERE v.field_id = ?5 AND v.updated_at >= ?7)`,
      )
      .bind(
        next.name,
        JSON.stringify(next.config),
        next.isActive ? 1 : 0,
        now,
        fieldId,
        workspaceId,
        readAt,
      )
      .run();
    changes = result.meta.changes;
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(NAME_TAKEN);
    throw error;
  }
  if (changes !== 1) {
    throw conflict('Il campo è stato modificato nel frattempo: aggiorna la pagina e riprova');
  }
  return getField(db, workspaceId, fieldId);
}

export async function moveField(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  fieldId: string,
  afterId: string | null,
  now: number,
): Promise<CustomField> {
  const field = await getField(db, workspaceId, fieldId);
  if (afterId === fieldId) throw conflict('Un campo non può seguire se stesso');
  const siblings = await readSiblings(d1, 'customFields', workspaceId, field.boardId, fieldId);
  const placement = decidePlacement(siblings, afterId, 'L’elenco dei campi');
  await d1.batch([
    ...(placement.rebalance
      ? [rebalanceStatement(d1, 'customFields', workspaceId, field.boardId, fieldId)]
      : []),
    d1
      .prepare(
        `UPDATE custom_field_definitions SET position = ?1, updated_at = ?2
         WHERE id = ?3 AND workspace_id = ?4 AND board_id = ?5`,
      )
      .bind(placement.position, now, fieldId, workspaceId, field.boardId),
  ]);
  return getField(db, workspaceId, fieldId);
}

/**
 * Eliminazione definitiva. Consigliata solo se il campo non è mai servito: la strada normale
 * è disattivarlo (i valori restano). Con valori salvati serve `deleteValues` esplicito.
 */
export async function deleteField(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  fieldId: string,
  deleteValues: boolean,
): Promise<void> {
  const field = await getField(db, workspaceId, fieldId);
  if (field.valueCount > 0 && !deleteValues) {
    throw conflict(
      `Il campo ha valori in ${field.valueCount} ${field.valueCount === 1 ? 'scheda' : 'schede'}: eliminandolo andranno persi. Per conservarli disattivalo.`,
    );
  }
  const result = await d1
    .prepare(
      `DELETE FROM custom_field_definitions WHERE id = ?1 AND workspace_id = ?2
         AND (?3 = 1 OR NOT EXISTS (SELECT 1 FROM custom_field_values WHERE field_id = ?1))`,
    )
    .bind(fieldId, workspaceId, deleteValues ? 1 : 0)
    .run();
  if (result.meta.changes < 1) {
    throw conflict('Il campo è cambiato nel frattempo: aggiorna la pagina e riprova');
  }
}

// ---------------------------------------------------------------------------
// Valori sulle schede
// ---------------------------------------------------------------------------

interface ValueRow extends FieldRow {
  stored: string | null;
}

function toCardField(row: ValueRow): CardCustomField {
  const field = toField(row);
  if (row.stored === null) return { field, value: null, hasValue: false };
  // Il valore persistito si rivalida con la definizione CORRENTE: non basta che sia JSON.
  try {
    const parsed = valueSchemaFor(field).safeParse(parseStoredCustomFieldValue(row.stored));
    if (parsed.success) return { field, value: parsed.data, hasValue: true };
  } catch {
    /* JSON corrotto: trattato come non conforme */
  }
  return { field, value: null, hasValue: false };
}

const VALUE_SELECT = sql`
  SELECT f.id AS id, f.board_id AS boardId, f.name AS name, f.type AS type, f.config AS config,
         f.position AS position, f.is_active AS isActive, f.created_at AS createdAt, f.updated_at AS updatedAt,
         (SELECT count(*) FROM custom_field_values c WHERE c.field_id = f.id AND c.workspace_id = f.workspace_id) AS valueCount,
         v.value AS stored
  FROM cards k
  JOIN custom_field_definitions f ON f.board_id = k.board_id AND f.workspace_id = k.workspace_id
  LEFT JOIN custom_field_values v ON v.card_id = k.id AND v.field_id = f.id AND v.workspace_id = k.workspace_id`;

/**
 * Campi ATTIVI della bacheca della scheda con il valore corrente. I campi disattivati restano
 * nascosti ma i loro valori sono conservati (e tornano alla riattivazione).
 */
export async function listCardFields(
  db: Database,
  workspaceId: string,
  cardId: string,
): Promise<CardCustomField[]> {
  await getCard(db, workspaceId, cardId); // 404 se non è del workspace
  const rows = await db.all<ValueRow>(
    sql`${VALUE_SELECT} WHERE k.id = ${cardId} AND k.workspace_id = ${workspaceId} AND f.is_active = 1 ORDER BY f.position, f.id`,
  );
  return rows.map(toCardField);
}

/**
 * Scrive il valore di un campo su una scheda. Il campo deve appartenere alla STESSA bacheca
 * della scheda (e al workspace): l'inserimento li ricerca insieme nel SQL, quindi un
 * `fieldId` di un'altra bacheca o di un altro workspace non produce mai una riga (404), e il
 * trigger di M0.H è l'ultima difesa. La scrittura è condizionata alla versione della
 * definizione letta, quindi non si salva mai un valore validato contro una configurazione superata.
 */
export async function putCardFieldValue(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  cardId: string,
  fieldId: string,
  raw: unknown,
  now: number,
): Promise<CardCustomField> {
  const card = await getCard(db, workspaceId, cardId);
  if (card.archivedAt !== null) {
    throw conflict('La scheda è archiviata: ripristinala prima di modificarla');
  }
  const field = await getField(db, workspaceId, fieldId);
  if (field.boardId !== card.boardId) throw notFound('Campo'); // altra bacheca: indistinguibile
  if (!field.isActive)
    throw conflict('Il campo è disattivato: riattivalo per modificarne i valori');

  const checked = validateCustomFieldValue(field, raw);
  if (!checked.success) {
    throw new ApiError(400, 'validation_error', 'Dati non validi', [
      { path: 'value', message: checked.message },
    ]);
  }
  const value: CustomFieldValue = checked.value;

  const [write] = await d1.batch([
    d1
      .prepare(
        `INSERT INTO custom_field_values (card_id, field_id, workspace_id, value, updated_at)
         SELECT k.id, f.id, k.workspace_id, ?4, ?5
         FROM cards k, custom_field_definitions f
         WHERE k.id = ?1 AND k.workspace_id = ?3 AND k.archived_at IS NULL
           AND f.id = ?2 AND f.workspace_id = ?3 AND f.board_id = k.board_id
           AND f.is_active = 1 AND f.updated_at = ?6
         ON CONFLICT (card_id, field_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .bind(cardId, fieldId, workspaceId, serializeCustomFieldValue(value), now, field.updatedAt),
    d1
      .prepare(`UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3`)
      .bind(now, cardId, workspaceId),
  ]);
  if (!write || write.meta.changes !== 1) {
    throw conflict('Il campo è cambiato nel frattempo: aggiorna la pagina e riprova');
  }
  const [updated] = (await listCardFields(db, workspaceId, cardId)).filter(
    (entry) => entry.field.id === fieldId,
  );
  if (!updated) throw notFound('Campo');
  return updated;
}
