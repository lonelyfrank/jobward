import { newId, type Database } from '@meet-roulette/database';
import type { CreateLabelInput, Label, UpdateLabelInput } from '@meet-roulette/schemas';
import { LIMITS } from '@meet-roulette/shared';
import { sql } from 'drizzle-orm';
import { conflict, notFound } from '../lib/errors';
import { getCard } from './cards';

const isUniqueViolation = (error: unknown) =>
  error instanceof Error &&
  /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(error.message);

const NAME_TAKEN = 'Esiste già un’etichetta con questo nome';

/** Etichette del workspace con il numero di schede, in ordine alfabetico (senza distinzione di maiuscole). */
export async function listLabels(db: Database, workspaceId: string): Promise<Label[]> {
  return db.all<Label>(sql`
    SELECT l.id AS id, l.name AS name, l.color AS color, l.created_at AS createdAt,
           (SELECT count(*) FROM card_labels cl WHERE cl.label_id = l.id AND cl.workspace_id = l.workspace_id) AS cardCount
    FROM labels l
    WHERE l.workspace_id = ${workspaceId}
    ORDER BY lower(l.name), l.id`);
}

async function getLabel(db: Database, workspaceId: string, labelId: string): Promise<Label> {
  const label = (await listLabels(db, workspaceId)).find((l) => l.id === labelId);
  if (!label) throw notFound('Etichetta'); // inesistente o di un altro workspace: stessa risposta
  return label;
}

/** Creazione con tetto per workspace verificato nella STESSA istruzione (nessuna finestra di concorrenza). */
export async function createLabel(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  input: CreateLabelInput,
  now: number,
): Promise<Label> {
  const id = newId();
  let changes: number;
  try {
    const result = await d1
      .prepare(
        `INSERT INTO labels (id, workspace_id, name, color, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5
         WHERE (SELECT count(*) FROM labels WHERE workspace_id = ?2) < ?6`,
      )
      .bind(id, workspaceId, input.name, input.color, now, LIMITS.labelsPerWorkspaceMax)
      .run();
    changes = result.meta.changes;
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(NAME_TAKEN);
    throw error;
  }
  if (changes !== 1) {
    throw conflict(`Puoi creare al massimo ${LIMITS.labelsPerWorkspaceMax} etichette`);
  }
  return getLabel(db, workspaceId, id);
}

export async function updateLabel(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  labelId: string,
  input: UpdateLabelInput,
): Promise<Label> {
  await getLabel(db, workspaceId, labelId);
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) {
    sets.push(`name = ?${values.length + 1}`);
    values.push(input.name);
  }
  if (input.color !== undefined) {
    sets.push(`color = ?${values.length + 1}`);
    values.push(input.color);
  }
  try {
    await d1
      .prepare(
        `UPDATE labels SET ${sets.join(', ')} WHERE id = ?${values.length + 1} AND workspace_id = ?${values.length + 2}`,
      )
      .bind(...values, labelId, workspaceId)
      .run();
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(NAME_TAKEN);
    throw error;
  }
  return getLabel(db, workspaceId, labelId);
}

/**
 * Eliminazione controllata: un'etichetta in uso richiede `force` (conferma esplicita
 * dell'interfaccia). Cancella SOLO l'etichetta e le sue assegnazioni, mai le schede.
 */
export async function deleteLabel(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  labelId: string,
  force: boolean,
): Promise<void> {
  const label = await getLabel(db, workspaceId, labelId);
  if (label.cardCount > 0 && !force) {
    throw conflict(
      `L’etichetta è assegnata a ${label.cardCount} ${label.cardCount === 1 ? 'scheda' : 'schede'}: confermando verrà rimossa da ${label.cardCount === 1 ? 'quella scheda' : 'tutte'}`,
    );
  }
  const result = await d1
    .prepare(
      `DELETE FROM labels WHERE id = ?1 AND workspace_id = ?2
         AND (?3 = 1 OR NOT EXISTS (SELECT 1 FROM card_labels WHERE label_id = ?1))`,
    )
    .bind(labelId, workspaceId, force ? 1 : 0)
    .run();
  if (result.meta.changes < 1) {
    // Assegnata a una scheda tra il controllo e la cancellazione (o già eliminata).
    throw conflict('L’etichetta è cambiata nel frattempo: riprova');
  }
}

// ---------------------------------------------------------------------------
// Assegnazione alle schede
// ---------------------------------------------------------------------------

async function cardLabelIds(db: Database, workspaceId: string, cardId: string): Promise<string[]> {
  return (await getCard(db, workspaceId, cardId)).labelIds;
}

const touchCard = (d1: D1Database, workspaceId: string, cardId: string, now: number) =>
  d1
    .prepare(`UPDATE cards SET updated_at = ?1 WHERE id = ?2 AND workspace_id = ?3`)
    .bind(now, cardId, workspaceId);

/**
 * Assegna un'etichetta a una scheda (idempotente). Scheda ed etichetta devono appartenere al
 * workspace: l'inserimento le ricerca ENTRAMBE nel SQL con `workspace_id`, quindi un ID altrui
 * non produce mai una riga, e la chiave esterna composita è l'ultima difesa.
 */
export async function assignLabel(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  cardId: string,
  labelId: string,
  now: number,
): Promise<string[]> {
  const card = await getCard(db, workspaceId, cardId);
  if (card.archivedAt !== null) {
    throw conflict('La scheda è archiviata: ripristinala prima di modificarla');
  }
  await getLabel(db, workspaceId, labelId); // 404 se non è del workspace
  if (card.labelIds.includes(labelId)) return card.labelIds;
  if (card.labelIds.length >= LIMITS.labelsPerCardMax) {
    throw conflict(`Una scheda può avere al massimo ${LIMITS.labelsPerCardMax} etichette`);
  }

  const [insert] = await d1.batch([
    d1
      .prepare(
        `INSERT INTO card_labels (card_id, label_id, workspace_id)
         SELECT k.id, l.id, k.workspace_id
         FROM cards k, labels l
         WHERE k.id = ?1 AND k.workspace_id = ?3 AND k.archived_at IS NULL
           AND l.id = ?2 AND l.workspace_id = ?3
           AND (SELECT count(*) FROM card_labels WHERE card_id = k.id) < ?4
         ON CONFLICT (card_id, label_id) DO NOTHING`,
      )
      .bind(cardId, labelId, workspaceId, LIMITS.labelsPerCardMax),
    touchCard(d1, workspaceId, cardId, now),
  ]);
  if (!insert) throw conflict('Impossibile assegnare l’etichetta');
  return cardLabelIds(db, workspaceId, cardId);
}

/** Rimuove un'etichetta da una scheda (idempotente). */
export async function unassignLabel(
  d1: D1Database,
  db: Database,
  workspaceId: string,
  cardId: string,
  labelId: string,
  now: number,
): Promise<string[]> {
  const card = await getCard(db, workspaceId, cardId);
  if (card.archivedAt !== null) {
    throw conflict('La scheda è archiviata: ripristinala prima di modificarla');
  }
  if (!card.labelIds.includes(labelId)) return card.labelIds;
  await d1.batch([
    d1
      .prepare(`DELETE FROM card_labels WHERE card_id = ?1 AND label_id = ?2 AND workspace_id = ?3`)
      .bind(cardId, labelId, workspaceId),
    touchCard(d1, workspaceId, cardId, now),
  ]);
  return cardLabelIds(db, workspaceId, cardId);
}
