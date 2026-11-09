// Future remote operations are opt-in; bundle never uses credentials or a remote D1.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const root = path.resolve(import.meta.dirname, '..');
const apiDir = path.join(root, 'apps/api');
const requireApi = createRequire(path.join(apiDir, 'package.json'));
const { unstable_readConfig: readConfig } = requireApi('wrangler');
const wranglerBin = path.resolve(
  path.dirname(requireApi.resolve('wrangler')),
  '../bin/wrangler.js',
);
export const templatePath = path.join(apiDir, 'wrangler.staging.example.json');
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const assert = (ok, reason) => {
  if (!ok) throw new Error(reason);
};
const uuid = (v) =>
  typeof v === 'string' &&
  /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(v);
const account = (v) => typeof v === 'string' && /^[\da-f]{32}$/i.test(v) && !/^0+$/.test(v);
const hash = (v) => typeof v === 'string' && /^[\da-f]{64}$/.test(v);
const keys = (obj, allowed) => Object.keys(obj).every((k) => allowed.includes(k));

export function validateTemplate(raw) {
  assert(
    keys(raw, [
      '$schema',
      'name',
      'main',
      'account_id',
      'compatibility_date',
      'workers_dev',
      'preview_urls',
      'routes',
      'observability',
      'assets',
      'env',
    ]),
    'Unexpected root configuration or binding',
  );
  assert(
    raw.name === 'jobward-staging-unconfigured' && raw.main === 'src/index.ts',
    'Wrong staging entry or default name',
  );
  assert(raw.compatibility_date === '2026-10-01', 'Compatibility date requires review');
  assert(
    raw.workers_dev === false && raw.preview_urls === false && same(raw.routes, []),
    'Public ingress disabled at root',
  );
  assert(same(raw.observability, { enabled: true }), 'Unexpected observability configuration');
  assert(
    same(raw.assets, {
      directory: '../web/dist',
      binding: 'ASSETS',
      not_found_handling: 'single-page-application',
      run_worker_first: ['/api/*'],
    }),
    'Unexpected asset configuration',
  );
  assert(
    same(Object.keys(raw.env ?? {}), ['staging']),
    'Only explicit staging environment allowed',
  );
  const env = raw.env.staging;
  assert(
    keys(env, ['name', 'workers_dev', 'preview_urls', 'routes', 'vars', 'd1_databases']),
    'Unexpected staging configuration or binding',
  );
  assert(
    env.name === 'jobward-staging' &&
      env.workers_dev === false &&
      env.preview_urls === false &&
      same(env.routes, []),
    'Only route-less staging bootstrap allowed',
  );
  assert(
    same(env.vars, { ENVIRONMENT: 'production', AUTH_MODE: 'access' }),
    'Invalid staging auth vars; no inline identity or credentials',
  );
  assert(env.d1_databases?.length === 1, 'Exactly one staging D1 binding required');
  const db = env.d1_databases[0];
  assert(
    keys(db, ['binding', 'database_name', 'database_id', 'migrations_dir']),
    'Unexpected D1 settings (no preview/remote binding)',
  );
  assert(
    db.binding === 'DB' &&
      db.database_name === 'jobward-staging-db' &&
      db.migrations_dir === '../../packages/database/migrations',
    'Wrong staging D1 binding',
  );
}

export function resolveTarget(configPath) {
  const configText = fs.readFileSync(configPath, 'utf8');
  const raw = JSON.parse(configText);
  validateTemplate(raw);
  // Resolve with the installed/pinned Wrangler, including inherited fields and paths.
  const resolved = readConfig({ config: configPath, env: 'staging' }, { hideWarnings: true });
  assert(
    resolved.name === 'jobward-staging' &&
      resolved.workers_dev === false &&
      resolved.preview_urls === false &&
      same(resolved.routes, []),
    'Resolved Worker target is unsafe',
  );
  assert(
    path.resolve(resolved.main) === path.join(apiDir, 'src/index.ts'),
    'Resolved entry is outside this checkout',
  );
  assert(
    path.resolve(path.dirname(configPath), resolved.assets.directory) ===
      path.join(root, 'apps/web/dist'),
    'Resolved assets outside this checkout',
  );
  const db = resolved.d1_databases?.[0];
  assert(
    resolved.account_id === (raw.account_id || undefined) &&
      db?.database_id === raw.env.staging.d1_databases[0].database_id,
    'Configuration changed while resolving the target',
  );
  assert(
    resolved.d1_databases?.length === 1 &&
      db.binding === 'DB' &&
      db.database_name === 'jobward-staging-db',
    'Resolved D1 binding mismatch',
  );
  assert(
    path.resolve(path.dirname(configPath), db.migrations_dir) ===
      path.join(root, 'packages/database/migrations'),
    'Resolved migrations outside this checkout',
  );
  assert(
    same(resolved.vars, { ENVIRONMENT: 'production', AUTH_MODE: 'access' }),
    'Resolved auth vars mismatch',
  );
  return { raw, resolved, db, configText };
}

export function validateInputs(target, inventory, auth, token, now = Date.now()) {
  const { resolved: cfg, db } = target;
  assert(
    account(cfg.account_id) && uuid(db.database_id),
    'Unresolved account/D1 ID (empty, local or placeholder)',
  );
  assert(
    inventory.schemaVersion === 1 && inventory.environment === 'staging',
    'Invalid inventory manifest',
  );
  assert(
    inventory.accountId === cfg.account_id &&
      inventory.workerName === cfg.name &&
      inventory.databaseId === db.database_id &&
      inventory.databaseName === db.database_name,
    'Resolved target differs from inventory',
  );
  const checked = Date.parse(inventory.verifiedAt);
  assert(
    Number.isFinite(checked) && checked <= now && now - checked < 24 * 3600_000,
    'Inventory missing, future-dated or older than 24h',
  );
  assert(
    inventory.legacyInventoryReviewed === true &&
      Array.isArray(inventory.protectedDatabaseIds) &&
      inventory.protectedDatabaseIds.every(uuid),
    'Legacy/production inventory not reviewed',
  );
  assert(
    !inventory.protectedDatabaseIds.some((id) => id.toLowerCase() === db.database_id.toLowerCase()),
    'D1 ID is protected/production',
  );
  assert(typeof inventory.workerExists === 'boolean', 'Worker existence not inventoried');
  assert(
    keys(auth, ['OWNER_EMAIL', 'ACCESS_TEAM_DOMAIN', 'ACCESS_AUD']) &&
      Object.keys(auth).length === 3,
    'Only three Access settings allowed in auth file',
  );
  assert(
    typeof auth.OWNER_EMAIL === 'string' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(auth.OWNER_EMAIL) &&
      auth.OWNER_EMAIL === auth.OWNER_EMAIL.trim().toLowerCase(),
    'Owner must be one normalized email',
  );
  assert(
    /^[a-z0-9-]+\.cloudflareaccess\.com$/.test(auth.ACCESS_TEAM_DOMAIN) && hash(auth.ACCESS_AUD),
    'Access issuer/audience incomplete',
  );
  assert(
    inventory.accessTeamDomain === auth.ACCESS_TEAM_DOMAIN &&
      inventory.accessAudience === auth.ACCESS_AUD &&
      inventory.ownerEmailSha256 === sha256(auth.OWNER_EMAIL),
    'Auth differs from reviewed staging identity',
  );
  assert(
    uuid(inventory.accessAppId) &&
      /^jobward-staging\.[a-z0-9.-]+\.[a-z]{2,}$/.test(inventory.hostname),
    'Access app/hostname unresolved',
  );
  assert(
    typeof token === 'string' &&
      token.length >= 20 &&
      hash(inventory.stagingCredentialSha256) &&
      sha256(token) === inventory.stagingCredentialSha256,
    'Explicit staging credential missing or mismatched',
  );
  assert(
    inventory.productionCredentialsReviewed === true &&
      Array.isArray(inventory.productionCredentialSha256) &&
      inventory.productionCredentialSha256.every(hash),
    'Production credential inventory not reviewed',
  );
  assert(
    !inventory.productionCredentialSha256.includes(sha256(token)),
    'Production credential cannot be used for staging',
  );
}

// Reads only; injected transport enables tests without Cloudflare or any real credential.
export async function verifyLive(target, inventory, auth, token, transport = fetch) {
  const get = async (endpoint, allow404 = false) => {
    let response;
    try {
      response = await transport(`https://api.cloudflare.com/client/v4${endpoint}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error('Cloud inventory read failed');
    }
    if (allow404 && response.status === 404) return null;
    assert(response.ok, 'Cloud inventory read denied');
    const data = await response.json();
    assert(data.success === true && data.result, 'Cloud inventory response invalid');
    return data.result;
  };
  const prefix = `/accounts/${target.resolved.account_id}`;
  const actualAccount = await get(prefix);
  assert(actualAccount.id === inventory.accountId, 'Authenticated account mismatch');
  const db = await get(`${prefix}/d1/database/${target.db.database_id}`);
  assert(
    db.uuid === inventory.databaseId && db.name === inventory.databaseName,
    'Live D1 identity mismatch',
  );
  const settings = await get(`${prefix}/workers/scripts/jobward-staging/settings`, true);
  assert(Boolean(settings) === inventory.workerExists, 'Worker existence changed since inventory');
  if (settings) {
    const bindings = settings.bindings?.filter((b) => b.type === 'd1') ?? [];
    assert(
      bindings.length === 1 && bindings[0].name === 'DB' && bindings[0].id === inventory.databaseId,
      'Existing Worker D1 binding mismatch',
    );
  }
  const app = await get(`${prefix}/access/apps/${inventory.accessAppId}`);
  assert(
    app.type === 'self_hosted' && app.domain === inventory.hostname && app.aud === auth.ACCESS_AUD,
    'Live Access application mismatch',
  );
  const policies = await get(`${prefix}/access/apps/${inventory.accessAppId}/policies`);
  assert(Array.isArray(policies) && policies.length === 1, 'Access requires one owner-only policy');
  const policy = policies[0];
  assert(
    policy.decision === 'allow' &&
      same(policy.include, [{ email: { email: auth.OWNER_EMAIL } }]) &&
      !policy.require?.length &&
      !policy.exclude?.length,
    'Access policy is not exactly owner-only',
  );
  const organization = await get(`${prefix}/access/organizations`);
  assert(organization.auth_domain === auth.ACCESS_TEAM_DOMAIN, 'Live Access issuer mismatch');
}

export function validateApproval(approval, operation, digests, commit, now = Date.now()) {
  assert(
    approval.approvedByOwner === true &&
      approval.operation === operation &&
      approval.gitCommit === commit,
    'Missing explicit approval for operation/commit',
  );
  for (const [key, value] of Object.entries(digests))
    assert(approval[key] === value, 'Approval does not match current files');
  const expires = Date.parse(approval.expiresAt);
  assert(expires > now && expires <= now + 24 * 3600_000, 'Approval expired or exceeds 24h');
}

export function childEnvironment(source, token, accountId) {
  const env = Object.fromEntries(
    Object.entries(source).filter(
      ([key]) => !/^(CLOUDFLARE_|CF_|WRANGLER_|JOBWARD_STAGING_)/.test(key),
    ),
  );
  return {
    ...env,
    WRANGLER_SEND_METRICS: 'false',
    ...(token ? { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId } : {}),
  };
}

function runWrangler(args, env, cwd) {
  const run = spawnSync(process.execPath, [wranglerBin, ...args], { cwd, env, stdio: 'inherit' });
  assert(!run.error && run.status === 0, 'Wrangler command failed');
}

export async function main(argv = process.argv.slice(2)) {
  const [operation, ...flags] = argv;
  assert(
    ['bundle', 'check', 'preflight', 'deploy', 'migrate'].includes(operation),
    'Use bundle, check, preflight, deploy or migrate',
  );
  const args = {};
  for (let i = 0; i < flags.length; i += 2) {
    const key = flags[i]?.replace(/^--/, '');
    assert(
      ['config', 'inventory', 'auth', 'approval'].includes(key) &&
        !args[key] &&
        flags[i + 1] &&
        !flags[i + 1].startsWith('--'),
      'Unknown, repeated or incomplete option',
    );
    args[key] = path.resolve(flags[i + 1]);
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jobward-staging-'));
  try {
    let raw, auth, stagingToken;
    if (operation === 'bundle') {
      assert(Object.keys(args).length === 0, 'Bundle accepts no remote inputs');
      raw = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
      validateTemplate(raw);
      assert(
        raw.account_id === '' && raw.env.staging.d1_databases[0].database_id === '',
        'Versioned template must not contain remote identifiers',
      );
      delete raw.account_id;
      raw.env.staging.d1_databases[0].database_id = 'local-staging-bundle';
    } else {
      for (const key of ['config', 'inventory', 'auth'])
        assert(args[key], 'Explicit config, inventory and auth files required');
      for (const file of Object.values(args)) {
        assert((fs.statSync(file).mode & 0o077) === 0, 'Private input files must have mode 0600');
        const tracked = spawnSync('git', ['check-ignore', '--quiet', file], { cwd: root });
        assert(tracked.status === 0, 'Private input files must be gitignored within this checkout');
      }
      const target = resolveTarget(args.config);
      const inventoryText = fs.readFileSync(args.inventory, 'utf8');
      const authText = fs.readFileSync(args.auth, 'utf8');
      const inventory = JSON.parse(inventoryText);
      auth = JSON.parse(authText);
      const token = process.env.JOBWARD_STAGING_API_TOKEN;
      validateInputs(target, inventory, auth, token);
      stagingToken = token;
      if (operation === 'check') {
        console.log(
          'Staging local inputs validated; cloud inventory NOT verified by this command.',
        );
        return;
      }
      if (['deploy', 'migrate'].includes(operation)) {
        assert(
          operation !== 'deploy' || inventory.workerExists === false,
          'This milestone only permits a new route-less Worker bootstrap',
        );
        assert(args.approval, 'Remote mutation requires an explicit approval file');
        const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
        const clean = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
        assert(
          commit.status === 0 && clean.status === 0 && clean.stdout.trim() === '',
          'Remote operations require a clean committed checkout',
        );
        validateApproval(
          JSON.parse(fs.readFileSync(args.approval, 'utf8')),
          operation,
          {
            configSha256: sha256(target.configText),
            inventorySha256: sha256(inventoryText),
            authSha256: sha256(authText),
          },
          commit.stdout.trim(),
        );
      }
      await verifyLive(target, inventory, auth, token);
      if (operation === 'preflight') {
        console.log(
          'Live staging account, D1 binding and owner-only Access verified. No mutation.',
        );
        return;
      }
      raw = target.raw;
    }
    // Freeze inputs in a clean directory. Wrangler cannot discover local .env/.dev.vars here.
    raw.main = path.join(apiDir, 'src/index.ts');
    raw.assets.directory = path.join(root, 'apps/web/dist');
    raw.env.staging.d1_databases[0].migrations_dir = path.join(
      root,
      'packages/database/migrations',
    );
    const frozenConfig = path.join(temp, 'wrangler.json');
    fs.writeFileSync(frozenConfig, JSON.stringify(raw), { mode: 0o600 });
    const env = childEnvironment(
      process.env,
      operation === 'bundle' ? null : stagingToken,
      raw.account_id,
    );
    if (operation === 'migrate') {
      runWrangler(
        [
          'd1',
          'migrations',
          'apply',
          'jobward-staging-db',
          '--remote',
          '--config',
          frozenConfig,
          '--env',
          'staging',
        ],
        env,
        temp,
      );
    } else {
      const deployArgs = [
        'deploy',
        '--config',
        frozenConfig,
        '--env',
        'staging',
        '--no-autoconfig',
      ];
      if (operation === 'bundle')
        deployArgs.push('--dry-run', '--outdir', path.join(apiDir, 'dist/staging'));
      else {
        const frozenAuth = path.join(temp, 'auth.json');
        fs.writeFileSync(frozenAuth, JSON.stringify(auth), { mode: 0o600 });
        deployArgs.push('--secrets-file', frozenAuth);
      }
      runWrangler(deployArgs, env, temp);
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(() => {
    console.error(
      'Staging guard refused the operation. Check the documented prerequisites; no secret values are logged.',
    );
    process.exitCode = 1;
  });
}
