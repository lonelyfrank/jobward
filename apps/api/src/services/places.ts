import { newId, type Database } from '@jobward/database';
import type { CreatePlaceInput, Place, UpdatePlaceInput } from '@jobward/schemas';
import { LIMITS } from '@jobward/shared';
import { sql } from 'drizzle-orm';
import { conflict, notFound } from '../lib/errors';
import { isConstraintError } from './ordering';

/**
 * Posizioni personali (D-07): casa (al massimo una) e altre posizioni catalogate. Appartengono
 * all'UTENTE, non al workspace: ogni query filtra per `user_id` preso dalla sessione, mai dal body.
 * Scegliere «casa» per una posizione rende «altra» la casa precedente nella stessa transazione.
 */
const SELECT = sql`SELECT id, name, kind, latitude, longitude, position, created_at AS createdAt,
  updated_at AS updatedAt FROM user_places`;

export async function listPlaces(db: Database, userId: string): Promise<Place[]> {
  return db.all<Place>(
    sql`${SELECT} WHERE user_id = ${userId} ORDER BY kind = 'home' DESC, position, created_at, id`,
  );
}

async function getPlace(db: Database, userId: string, id: string) {
  const [place] = await db.all<Place>(sql`${SELECT} WHERE user_id = ${userId} AND id = ${id}`);
  if (!place) throw notFound('Posizione');
  return place;
}

const duplicate = () => conflict('Hai già una posizione con questo nome');

/** Rende «altra» la casa attuale (tranne `keepId`): precede la scrittura nello stesso batch. */
const demoteHome = (d1: D1Database, userId: string, keepId: string, now: number) =>
  d1
    .prepare(
      `UPDATE user_places SET kind = 'other', updated_at = ?3
       WHERE user_id = ?1 AND kind = 'home' AND id <> ?2`,
    )
    .bind(userId, keepId, now);

export async function createPlace(
  d1: D1Database,
  db: Database,
  userId: string,
  input: CreatePlaceInput,
  now: number,
): Promise<Place> {
  const id = newId();
  const insert = d1
    .prepare(
      `INSERT INTO user_places (id, user_id, name, kind, latitude, longitude, position, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6,
              COALESCE((SELECT max(position) FROM user_places WHERE user_id = ?2), 0) + 1, ?7, ?7
       WHERE (SELECT count(*) FROM user_places WHERE user_id = ?2) < ?8`,
    )
    .bind(
      id,
      userId,
      input.name,
      input.kind,
      input.latitude,
      input.longitude,
      now,
      LIMITS.placesPerUserMax,
    );
  try {
    // Il tetto si verifica PRIMA di declassare la casa: oltre il limite non cambia nulla.
    const [{ count } = { count: 0 }] = await db.all<{ count: number }>(
      sql`SELECT count(*) AS count FROM user_places WHERE user_id = ${userId}`,
    );
    if (count >= LIMITS.placesPerUserMax) {
      throw conflict(`Puoi salvare al massimo ${LIMITS.placesPerUserMax} posizioni`);
    }
    const results = await d1.batch(
      input.kind === 'home' ? [demoteHome(d1, userId, id, now), insert] : [insert],
    );
    if (results[results.length - 1]?.meta.changes !== 1) {
      throw conflict(`Puoi salvare al massimo ${LIMITS.placesPerUserMax} posizioni`);
    }
  } catch (error) {
    if (isConstraintError(error)) throw duplicate();
    throw error;
  }
  return getPlace(db, userId, id);
}

export async function updatePlace(
  d1: D1Database,
  db: Database,
  userId: string,
  id: string,
  input: UpdatePlaceInput,
  now: number,
): Promise<Place> {
  await getPlace(db, userId, id);
  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    sets.push(`${column} = ?${values.length + 1}`);
    values.push(value);
  };
  if (input.name !== undefined) set('name', input.name);
  if (input.kind !== undefined) set('kind', input.kind);
  if (input.latitude !== undefined) set('latitude', input.latitude);
  if (input.longitude !== undefined) set('longitude', input.longitude);
  set('updated_at', now);
  const update = d1
    .prepare(
      `UPDATE user_places SET ${sets.join(', ')} WHERE id = ?${values.length + 1} AND user_id = ?${values.length + 2}`,
    )
    .bind(...values, id, userId);
  try {
    await d1.batch(input.kind === 'home' ? [demoteHome(d1, userId, id, now), update] : [update]);
  } catch (error) {
    if (isConstraintError(error)) throw duplicate();
    throw error;
  }
  return getPlace(db, userId, id);
}

export async function deletePlace(d1: D1Database, db: Database, userId: string, id: string) {
  await getPlace(db, userId, id);
  await d1.prepare('DELETE FROM user_places WHERE id = ?1 AND user_id = ?2').bind(id, userId).run();
}
