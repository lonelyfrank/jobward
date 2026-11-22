import { env } from 'cloudflare:workers';
import { createDb, newId, schema } from '@jobward/database';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import type { createApp } from '../src/app';
import type { Bindings } from '../src/env';

export const TEAM = 'testteam.cloudflareaccess.com';
export const AUD = 'test-audience-tag';
export const OWNER = 'owner@example.com';

export type ApiResult<T = unknown> = { status: number; body: T; headers: Headers };

/** Coppia di chiavi locale che sostituisce il JWKS remoto di Cloudflare Access. */
export async function createAccessSigner() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const keys = createLocalJWKSet({ keys: [jwk] });

  const sign = (
    claims: { email?: string; aud?: string; iss?: string; exp?: string | number } = {},
    signingKey = privateKey,
  ) =>
    new SignJWT({ email: 'email' in claims ? claims.email : OWNER })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(claims.iss ?? `https://${TEAM}`)
      .setAudience(claims.aud ?? AUD)
      .setIssuedAt()
      .setExpirationTime(claims.exp ?? '5m')
      .sign(signingKey);

  return { keys, sign, generateOtherKey: () => generateKeyPair('RS256') };
}

export const devEnv = (email: string, overrides: Partial<Bindings> = {}): Bindings => ({
  ...(env as unknown as Bindings),
  ENVIRONMENT: 'development',
  AUTH_MODE: 'dev',
  DEV_USER_EMAIL: email,
  ...overrides,
});

export const accessEnv = (overrides: Partial<Bindings> = {}): Bindings => ({
  ...(env as unknown as Bindings),
  ENVIRONMENT: 'production',
  AUTH_MODE: 'access',
  OWNER_EMAIL: OWNER,
  ACCESS_TEAM_DOMAIN: TEAM,
  ACCESS_AUD: AUD,
  ...overrides,
});

/** Esegue una richiesta contro l'app con l'ambiente indicato e restituisce JSON. */
export async function call<T = any>(
  app: ReturnType<typeof createApp>,
  bindings: Bindings,
  path: string,
  init: { method?: string; headers?: Record<string, string>; json?: unknown; body?: BodyInit } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { ...init.headers };
  let body = init.body;
  if (init.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await app.request(path, { method: init.method ?? 'GET', headers, body }, bindings);
  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    body: (text ? JSON.parse(text) : null) as T,
  };
}

export const db = () => createDb(env.DB);

/** Inserisce un workspace con membership owner direttamente nel database. */
export async function seedWorkspace(ownerEmail: string, name = 'Seed') {
  const d = db();
  const now = Date.now();
  const userId = newId();
  const workspaceId = newId();
  await d
    .insert(schema.users)
    .values({ id: userId, email: ownerEmail, createdAt: now, updatedAt: now });
  await d
    .insert(schema.workspaces)
    .values({ id: workspaceId, name, timezone: 'UTC', createdAt: now, updatedAt: now });
  await d
    .insert(schema.workspaceMembers)
    .values({ workspaceId, userId, role: 'owner', createdAt: now });
  return { userId, workspaceId };
}

export async function seedBoardWithColumn(workspaceId: string, now = Date.now()) {
  const d = db();
  const boardId = newId();
  const columnId = newId();
  await d.insert(schema.boards).values({
    id: boardId,
    workspaceId,
    name: 'Bacheca',
    position: 0,
    createdAt: now,
    updatedAt: now,
  });
  await d.insert(schema.boardColumns).values({
    id: columnId,
    workspaceId,
    boardId,
    name: 'Salvate',
    position: 0,
    createdAt: now,
    updatedAt: now,
  });
  return { boardId, columnId };
}

export async function seedCard(
  workspaceId: string,
  boardId: string,
  columnId: string,
  opts: {
    title?: string;
    archivedAt?: number | null;
    appliedOn?: string;
    stage?: (typeof schema.applications.$inferInsert)['stage'];
    outcome?: (typeof schema.applications.$inferInsert)['outcome'];
  } = {},
) {
  const d = db();
  const now = Date.now();
  const id = newId();
  await d.insert(schema.cards).values({
    id,
    workspaceId,
    boardId,
    columnId,
    title: opts.title ?? 'Scheda',
    position: 0,
    createdAt: now,
    updatedAt: now,
    archivedAt: opts.archivedAt ?? null,
  });
  // Lo stato della candidatura vive in `applications`: una prima candidatura se è indicato qualcosa.
  if (opts.appliedOn || opts.stage || opts.outcome) {
    await d.insert(schema.applications).values({
      id: newId(),
      workspaceId,
      opportunityId: id,
      sequence: 1,
      appliedOn: opts.appliedOn ?? null,
      stage: opts.stage ?? null,
      outcome: opts.outcome ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }
  return id;
}

export async function seedTask(
  workspaceId: string,
  opts: {
    title: string;
    dueOn?: string | null;
    completedAt?: number | null;
    cancelledAt?: number | null;
    cardId?: string | null;
    kind?: 'general' | 'follow_up' | 'preparation';
    priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  },
) {
  const now = Date.now();
  const id = newId();
  await db()
    .insert(schema.tasks)
    .values({
      id,
      workspaceId,
      cardId: opts.cardId ?? null,
      title: opts.title,
      dueOn: opts.dueOn ?? null,
      completedAt: opts.completedAt ?? null,
      cancelledAt: opts.cancelledAt ?? null,
      kind: opts.kind ?? 'general',
      priority: opts.priority ?? 'none',
      createdAt: now,
      updatedAt: now,
    });
  return id;
}

/**
 * Imposta lo stato della candidatura CORRENTE di un'opportunità direttamente nel database (prepara i dati dei
 * test che non riguardano la pipeline). Crea la prima candidatura se non esiste.
 */
export async function setApplicationState(
  cardId: string,
  state: {
    stage?: (typeof schema.applications.$inferInsert)['stage'];
    outcome?: (typeof schema.applications.$inferInsert)['outcome'];
    appliedOn?: string | null;
  },
) {
  const now = Date.now();
  const card = await env.DB.prepare('SELECT workspace_id FROM cards WHERE id = ?1')
    .bind(cardId)
    .first<{ workspace_id: string }>();
  if (!card) throw new Error(`scheda inesistente: ${cardId}`);
  const current = await env.DB.prepare(
    'SELECT id FROM current_applications WHERE opportunity_id = ?1',
  )
    .bind(cardId)
    .first<{ id: string }>();
  if (current) {
    await env.DB.prepare(
      `UPDATE applications SET stage = coalesce(?1, stage), outcome = CASE WHEN ?2 = 1 THEN ?3 ELSE outcome END,
         applied_on = CASE WHEN ?4 = 1 THEN ?5 ELSE applied_on END, updated_at = ?6 WHERE id = ?7`,
    )
      .bind(
        state.stage ?? null,
        state.outcome !== undefined ? 1 : 0,
        state.outcome ?? null,
        state.appliedOn !== undefined ? 1 : 0,
        state.appliedOn ?? null,
        now,
        current.id,
      )
      .run();
    return current.id;
  }
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO applications (id, workspace_id, opportunity_id, sequence, stage, outcome, applied_on, created_at, updated_at)
     VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7, ?7)`,
  )
    .bind(
      id,
      card.workspace_id,
      cardId,
      state.stage ?? null,
      state.outcome ?? null,
      state.appliedOn ?? null,
      now,
    )
    .run();
  return id;
}
