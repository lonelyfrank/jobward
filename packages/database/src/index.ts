import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export * as schema from './schema';

export type Database = ReturnType<typeof createDb>;

/** Crea il client Drizzle a partire dal binding D1 del Worker. */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

/** Identificativo opaco per le nuove righe. */
export function newId(): string {
  return crypto.randomUUID();
}
