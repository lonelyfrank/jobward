import { newId, schema, type Database } from '@meet-roulette/database';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '../env';

/** Restituisce l'utente con questa email, creandolo al primo accesso. */
export async function ensureUser(db: Database, email: string, now: number): Promise<AuthUser> {
  const normalized = email.toLowerCase();
  const find = () =>
    db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.email, normalized))
      .get();

  const existing = await find();
  if (existing) return existing;

  // Gestisce la corsa tra due richieste simultanee del primo accesso.
  await db
    .insert(schema.users)
    .values({ id: newId(), email: normalized, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: schema.users.email });

  const created = await find();
  if (!created) throw new Error('user_creation_failed');
  return created;
}
