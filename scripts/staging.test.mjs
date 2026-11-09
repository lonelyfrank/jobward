import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import {
  root,
  templatePath,
  sha256,
  validateTemplate,
  resolveTarget,
  validateInputs,
  verifyLive,
  validateApproval,
  childEnvironment,
  main,
} from './staging.mjs';

// Synthetic IDs/tokens only. No network transport or remote command runs in this suite.
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
const token = 'synthetic-staging-token-for-guard-tests';
const accountId = 'a'.repeat(32);
const databaseId = '11111111-1111-4111-8111-111111111111';
const protectedId = '22222222-2222-4222-8222-222222222222';
const now = Date.now();
const auth = {
  OWNER_EMAIL: 'owner@example.com',
  ACCESS_TEAM_DOMAIN: 'fixture.cloudflareaccess.com',
  ACCESS_AUD: 'a'.repeat(64),
};
const manifest = {
  schemaVersion: 1,
  environment: 'staging',
  accountId,
  workerName: 'jobward-staging',
  databaseName: 'jobward-staging-db',
  databaseId,
  verifiedAt: new Date(now - 1000).toISOString(),
  workerExists: false,
  legacyInventoryReviewed: true,
  protectedDatabaseIds: [protectedId],
  productionCredentialsReviewed: true,
  productionCredentialSha256: [sha256('synthetic-production-token')],
  stagingCredentialSha256: sha256(token),
  ownerEmailSha256: sha256(auth.OWNER_EMAIL),
  accessTeamDomain: auth.ACCESS_TEAM_DOMAIN,
  accessAudience: auth.ACCESS_AUD,
  accessAppId: '33333333-3333-4333-8333-333333333333',
  hostname: 'jobward-staging.example.com',
};
const files = [];
after(() => {
  for (const file of files) fs.unlinkSync(file);
});
function configuration(edit = () => {}) {
  const raw = structuredClone(template);
  raw.account_id = accountId;
  raw.env.staging.d1_databases[0].database_id = databaseId;
  edit(raw);
  const file = path.join(root, `apps/api/.env.staging-test-${randomUUID()}.json`);
  fs.writeFileSync(file, JSON.stringify(raw), { mode: 0o600 });
  files.push(file);
  return file;
}
const target = () => resolveTarget(configuration());

test('versioned staging template has no fabricated remote IDs, PII or remote fallback', () => {
  validateTemplate(template);
  assert.equal(template.account_id, '');
  assert.equal(template.env.staging.d1_databases[0].database_id, '');
  assert.throws(
    () => validateInputs(resolveTarget(templatePath), manifest, auth, token, now),
    /Unresolved/,
  );
});

test('Wrangler resolves the actual entry, inherited assets, account and D1 binding', () => {
  const actual = target();
  assert.equal(actual.resolved.main, path.join(root, 'apps/api/src/index.ts'));
  assert.equal(actual.resolved.account_id, accountId);
  assert.equal(actual.db.database_id, databaseId);
  validateInputs(actual, manifest, auth, token, now);
});

for (const [name, edit] of [
  [
    'production name',
    (c) => {
      c.env.staging.name = 'jobward';
    },
  ],
  [
    'root binding fallback',
    (c) => {
      c.d1_databases = c.env.staging.d1_databases;
    },
  ],
  [
    'missing env binding',
    (c) => {
      delete c.env.staging.d1_databases;
    },
  ],
  [
    'wrong binding',
    (c) => {
      c.env.staging.d1_databases[0].binding = 'PRODUCTION';
    },
  ],
  [
    'worker URL',
    (c) => {
      c.env.staging.workers_dev = true;
    },
  ],
  [
    'preview URL',
    (c) => {
      c.preview_urls = true;
    },
  ],
  [
    'early route',
    (c) => {
      c.env.staging.routes = [{ pattern: manifest.hostname, custom_domain: true }];
    },
  ],
  [
    'dev authentication',
    (c) => {
      c.env.staging.vars.AUTH_MODE = 'dev';
    },
  ],
  [
    'inline owner',
    (c) => {
      c.env.staging.vars.OWNER_EMAIL = auth.OWNER_EMAIL;
    },
  ],
  [
    'unexpected service binding',
    (c) => {
      c.env.staging.services = [{ binding: 'OTHER', service: 'other' }];
    },
  ],
  [
    'remote development binding',
    (c) => {
      c.env.staging.d1_databases[0].remote = true;
    },
  ],
  [
    'preview database',
    (c) => {
      c.env.staging.d1_databases[0].preview_database_id = protectedId;
    },
  ],
  [
    'different migrations',
    (c) => {
      c.env.staging.d1_databases[0].migrations_dir = '../other';
    },
  ],
])
  test(`rejects config: ${name}`, () => assert.throws(() => resolveTarget(configuration(edit))));

for (const [name, edit] of [
  [
    'empty',
    (t) => {
      t.db.database_id = '';
    },
  ],
  [
    'local',
    (t) => {
      t.db.database_id = 'local-preview';
    },
  ],
  [
    'zero placeholder',
    (t) => {
      t.db.database_id = '00000000-0000-0000-0000-000000000000';
    },
  ],
  [
    'same name different UUID',
    (t) => {
      t.db.database_id = protectedId;
    },
  ],
  [
    'protected UUID with matching manifest',
    (t, m) => {
      m.protectedDatabaseIds.push(t.db.database_id);
    },
  ],
  [
    'account mismatch',
    (t, m) => {
      m.accountId = 'b'.repeat(32);
    },
  ],
  [
    'stale inventory',
    (t, m) => {
      m.verifiedAt = new Date(now - 25 * 3600_000).toISOString();
    },
  ],
  [
    'no legacy review',
    (t, m) => {
      m.legacyInventoryReviewed = false;
    },
  ],
  [
    'production credential',
    (t, m) => {
      m.productionCredentialSha256.push(sha256(token));
    },
  ],
  [
    'wrong credential',
    (t, m) => {
      m.stagingCredentialSha256 = '0'.repeat(64);
    },
  ],
  [
    'unresolved Access',
    (t, m) => {
      m.accessAppId = '';
    },
  ],
])
  test(`rejects inputs: ${name}`, () => {
    const t = target(),
      m = structuredClone(manifest);
    edit(t, m);
    assert.throws(() => validateInputs(t, m, auth, token, now));
  });

function cloudTransport(overrides = {}, m = manifest) {
  const prefix = `/accounts/${accountId}`;
  const results = {
    [prefix]: { id: accountId },
    [`${prefix}/d1/database/${databaseId}`]: { uuid: databaseId, name: m.databaseName },
    [`${prefix}/workers/scripts/jobward-staging/settings`]: null,
    [`${prefix}/access/apps/${m.accessAppId}`]: {
      type: 'self_hosted',
      domain: m.hostname,
      aud: auth.ACCESS_AUD,
    },
    [`${prefix}/access/apps/${m.accessAppId}/policies`]: [
      { decision: 'allow', include: [{ email: { email: auth.OWNER_EMAIL } }] },
    ],
    [`${prefix}/access/organizations`]: { auth_domain: auth.ACCESS_TEAM_DOMAIN },
    ...overrides,
  };
  const calls = [];
  return {
    calls,
    transport: async (url, init) => {
      assert.equal(init.method, 'GET');
      assert.equal(init.headers.Authorization, `Bearer ${token}`);
      assert.equal(init.redirect, 'error');
      const endpoint = url.replace('https://api.cloudflare.com/client/v4', '');
      assert.ok(endpoint in results);
      calls.push(endpoint);
      const result = results[endpoint];
      return new Response(JSON.stringify({ success: true, result }), {
        status: result === null ? 404 : 200,
      });
    },
  };
}

test('live preflight verifies actual account/UUID/Access using GET only', async () => {
  const cloud = cloudTransport();
  await verifyLive(target(), manifest, auth, token, cloud.transport);
  assert.equal(cloud.calls.length, 6);
});
for (const [name, endpoint, result] of [
  ['authenticated account', `/accounts/${accountId}`, { id: 'b'.repeat(32) }],
  [
    'D1 name reused',
    `/accounts/${accountId}/d1/database/${databaseId}`,
    { uuid: protectedId, name: manifest.databaseName },
  ],
  [
    'Worker appeared',
    `/accounts/${accountId}/workers/scripts/jobward-staging/settings`,
    { bindings: [] },
  ],
  [
    'different audience',
    `/accounts/${accountId}/access/apps/${manifest.accessAppId}`,
    { type: 'self_hosted', domain: manifest.hostname, aud: 'b'.repeat(64) },
  ],
  [
    'bypass',
    `/accounts/${accountId}/access/apps/${manifest.accessAppId}/policies`,
    [{ decision: 'bypass', include: [{ everyone: {} }] }],
  ],
  [
    'whole email domain',
    `/accounts/${accountId}/access/apps/${manifest.accessAppId}/policies`,
    [{ decision: 'allow', include: [{ email_domain: { domain: 'example.com' } }] }],
  ],
  [
    'issuer mismatch',
    `/accounts/${accountId}/access/organizations`,
    { auth_domain: 'other.cloudflareaccess.com' },
  ],
])
  test(`live identity mismatch: ${name}`, async () => {
    const cloud = cloudTransport({ [endpoint]: result });
    await assert.rejects(verifyLive(target(), manifest, auth, token, cloud.transport));
  });
test('network failure denies; no mutation follows', async () => {
  await assert.rejects(
    verifyLive(target(), manifest, auth, token, () => {
      throw new Error('network');
    }),
    /read failed/,
  );
});
test('existing Worker binding is checked independently of its name', async () => {
  const m = { ...manifest, workerExists: true };
  const cloud = cloudTransport(
    {
      [`/accounts/${accountId}/workers/scripts/jobward-staging/settings`]: {
        bindings: [{ type: 'd1', name: 'DB', id: protectedId }],
      },
    },
    m,
  );
  await assert.rejects(verifyLive(target(), m, auth, token, cloud.transport), /binding mismatch/);
});

test('approval is tied to operation, commit, exact input hashes and expiry', () => {
  const digests = {
    configSha256: sha256('config'),
    inventorySha256: sha256('inventory'),
    authSha256: sha256('auth'),
  };
  const approval = {
    ...digests,
    approvedByOwner: true,
    operation: 'deploy',
    gitCommit: 'fixture-sha',
    expiresAt: new Date(now + 60_000).toISOString(),
  };
  validateApproval(approval, 'deploy', digests, 'fixture-sha', now);
  for (const changed of [
    { operation: 'migrate' },
    { gitCommit: 'different' },
    { approvedByOwner: false },
    { configSha256: sha256('changed') },
    { expiresAt: new Date(now - 1).toISOString() },
  ])
    assert.throws(() =>
      validateApproval({ ...approval, ...changed }, 'deploy', digests, 'fixture-sha', now),
    );
});
test('child process never falls back to inherited Cloudflare credentials/profile', () => {
  const env = childEnvironment(
    {
      PATH: '/bin',
      CLOUDFLARE_API_TOKEN: 'production',
      CF_API_KEY: 'production',
      WRANGLER_PROFILE: 'production',
      JOBWARD_STAGING_API_TOKEN: token,
    },
    token,
    accountId,
  );
  assert.equal(env.CLOUDFLARE_API_TOKEN, token);
  assert.equal(env.CLOUDFLARE_ACCOUNT_ID, accountId);
  assert.equal(env.WRANGLER_PROFILE, undefined);
  assert.equal(env.CF_API_KEY, undefined);
  assert.equal(env.JOBWARD_STAGING_API_TOKEN, undefined);
  assert.equal(childEnvironment(env, null).CLOUDFLARE_API_TOKEN, undefined);
});
test('CLI rejects default/production, missing manifest and arbitrary Wrangler overrides before any remote read', async () => {
  for (const args of [
    [],
    ['deploy'],
    ['migrate'],
    ['deploy', '--env', 'production'],
    ['deploy', '--name', 'jobward'],
    ['bundle', '--config', 'wrangler.jsonc'],
  ]) {
    await assert.rejects(main(args));
  }
});
