// Prova di aggiornamento: un database prodotto da M1 (migrazioni 0000–0002) e POPOLATO viene
// portato all'ultima migrazione con wrangler/D1 locale. Verifica che nessun dato vada perso,
// che le righe esistenti ricevano "non specificato" (NULL) e che i nuovi vincoli funzionino.
// Non tocca il repository: tutto avviene in una cartella temporanea.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'packages/database/migrations');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-upgrade-'));
const migrations = path.join(tmp, 'migrations');
const state = path.join(tmp, 'state');
fs.mkdirSync(migrations);

const files = fs
  .readdirSync(source)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const last = files.at(-1);
const baseline = files.filter((f) => f < '0003'); // il database "di M1"
const upgrade = files.filter((f) => f >= '0003');
if (upgrade.length === 0) throw new Error('Nessuna migrazione successiva a M1 da provare');

fs.writeFileSync(
  path.join(tmp, 'wrangler.jsonc'),
  JSON.stringify({
    name: 'mr-upgrade-test',
    compatibility_date: '2026-01-01',
    d1_databases: [
      {
        binding: 'DB',
        database_name: 'mr-upgrade',
        database_id: 'local-upgrade',
        migrations_dir: migrations,
      },
    ],
  }),
);

const wrangler = (args, { quiet = false } = {}) => {
  const r = spawnSync(
    'pnpm',
    [
      '--filter',
      '@meet-roulette/api',
      'exec',
      'wrangler',
      ...args,
      '--config',
      path.join(tmp, 'wrangler.jsonc'),
      '--persist-to',
      state,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  if (r.status !== 0) {
    if (!quiet) console.error(r.stdout, r.stderr);
    throw new Error(`wrangler ${args.slice(0, 3).join(' ')} non riuscito`);
  }
  return r.stdout;
};
const query = (sql) => {
  const out = wrangler(['d1', 'execute', 'DB', '--local', '--json', '--command', sql]);
  return JSON.parse(out.slice(out.indexOf('[')))[0].results;
};
const run = (sql, options) => {
  const file = path.join(tmp, 'q.sql');
  fs.writeFileSync(file, sql);
  wrangler(['d1', 'execute', 'DB', '--local', '--file', file], options);
};
const expect = (cond, message) => {
  if (!cond) throw new Error(`✖ ${message}`);
  console.log(`  ✓ ${message}`);
};

try {
  for (const f of baseline) fs.copyFileSync(path.join(source, f), path.join(migrations, f));
  console.log(`1. Database M1: ${baseline.join(', ')}`);
  wrangler(['d1', 'migrations', 'apply', 'DB', '--local']);

  // Dati realistici: 2 workspace, 3 bacheche, 600 schede (alcune archiviate), dettagli, eventi.
  const now = Date.now();
  run(`
    INSERT INTO users (id,email,display_name,created_at,updated_at) VALUES ('u1','a@example.com',NULL,${now},${now}),('u2','b@example.com',NULL,${now},${now});
    INSERT INTO workspaces (id,name,timezone,created_at,updated_at) VALUES ('w1','Uno','UTC',${now},${now}),('w2','Due','UTC',${now},${now});
    INSERT INTO workspace_members (workspace_id,user_id,role,created_at) VALUES ('w1','u1','owner',${now}),('w2','u2','owner',${now});
    INSERT INTO boards (id,workspace_id,name,position,is_favorite,created_at,updated_at) VALUES ('b1','w1','Prima',1024,0,${now},${now}),('b2','w1','Seconda',2048,0,${now},${now}),('b3','w2','Altrui',1024,0,${now},${now});
    INSERT INTO board_columns (id,workspace_id,board_id,name,position,category,created_at,updated_at) VALUES
      ('c1','w1','b1','Salvate',1024,'saved',${now},${now}),('c2','w1','b1','Colloquio',2048,'interviewing',${now},${now}),
      ('c3','w1','b2','Altre',1024,NULL,${now},${now}),('c4','w2','b3','Altrui',1024,NULL,${now},${now});
    WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < 600)
      INSERT INTO cards (id,workspace_id,board_id,column_id,title,description,position,priority,created_at,updated_at,archived_at)
      SELECT 'k'||i,'w1','b1',CASE WHEN i%2=0 THEN 'c1' ELSE 'c2' END,'Scheda '||i,NULL,i*1024,'none',${now},${now},CASE WHEN i%10=0 THEN ${now} ELSE NULL END FROM n;
    INSERT INTO cards (id,workspace_id,board_id,column_id,title,position,priority,created_at,updated_at) VALUES ('kx','w2','b3','c4','Riservata',1024,'high',${now},${now});
    INSERT INTO application_details (card_id,workspace_id,company,source_url,stage,applied_on,salary_min,salary_max,currency,created_at,updated_at) VALUES
      ('k1','w1','Acme','https://example.com/1','applied','2026-10-01',1000,2000,'EUR',${now},${now}),
      ('k2','w1','Beta',NULL,NULL,NULL,NULL,NULL,NULL,${now},${now}),
      ('kx','w2','Segreta','https://example.com/s',NULL,NULL,NULL,NULL,NULL,${now},${now});
    INSERT INTO activity_events (id,workspace_id,board_id,card_id,actor_user_id,type,metadata,occurred_at) VALUES ('e1','w1','b1','k1','u1','card_created','{}',${now});
    INSERT INTO labels (id,workspace_id,name,color,created_at) VALUES ('l1','w1','Interessante','green',${now});
  `);
  const before = {
    cards: query('SELECT count(*) n FROM cards')[0].n,
    archived: query('SELECT count(*) n FROM cards WHERE archived_at IS NOT NULL')[0].n,
    details: query(
      'SELECT card_id, company, source_url, stage, applied_on, salary_min, salary_max, currency FROM application_details ORDER BY card_id',
    ),
    events: query('SELECT count(*) n FROM activity_events')[0].n,
  };
  console.log(
    `   ${before.cards} schede (${before.archived} archiviate), ${before.details.length} righe di dettagli`,
  );

  console.log(`2. Aggiornamento: ${upgrade.join(', ')}`);
  for (const f of upgrade) fs.copyFileSync(path.join(source, f), path.join(migrations, f));
  wrangler(['d1', 'migrations', 'apply', 'DB', '--local']);

  const after = {
    cards: query('SELECT count(*) n FROM cards')[0].n,
    archived: query('SELECT count(*) n FROM cards WHERE archived_at IS NOT NULL')[0].n,
    details: query(
      'SELECT card_id, company, source_url, stage, applied_on, salary_min, salary_max, currency FROM application_details ORDER BY card_id',
    ),
    events: query('SELECT count(*) n FROM activity_events')[0].n,
  };
  expect(
    after.cards === before.cards && after.archived === before.archived,
    `schede intatte (${after.cards}, di cui ${after.archived} archiviate)`,
  );
  expect(
    JSON.stringify(after.details) === JSON.stringify(before.details),
    'dettagli di M1 identici, campo per campo',
  );
  expect(after.events === before.events, 'cronologia intatta');
  expect(
    query('SELECT count(*) n FROM application_details WHERE salary_basis IS NOT NULL')[0].n === 0,
    'lordo/netto = non specificato (NULL) per tutte le righe esistenti',
  );
  expect(query('PRAGMA foreign_key_check').length === 0, 'nessuna violazione di chiavi esterne');
  expect(
    query(
      "SELECT count(*) n FROM sqlite_master WHERE name IN ('cards_workspace_updated_idx','custom_field_definitions_board_name_unique')",
    )[0].n === 2,
    'indici nuovi presenti',
  );
  expect(
    query("SELECT count(*) n FROM sqlite_master WHERE type='trigger'")[0].n >= 1,
    'trigger di integrità ancora presenti',
  );

  console.log('3. Vincoli dopo l’aggiornamento');
  const rejects = (sql) => {
    try {
      run(sql, { quiet: true });
      return false;
    } catch {
      return true;
    }
  };
  expect(
    rejects("UPDATE application_details SET salary_basis='lordissimo' WHERE card_id='k1'"),
    'salary_basis rifiuta valori fuori vocabolario',
  );
  expect(
    !rejects("UPDATE application_details SET salary_basis='net' WHERE card_id='k1'"),
    "salary_basis accetta 'net'",
  );
  expect(
    rejects(
      "INSERT INTO cards (id,workspace_id,board_id,column_id,title,position,priority,created_at,updated_at) VALUES ('bad','w1','b2','c1','x',1,'none',1,1)",
    ),
    'scheda su una colonna di un’altra bacheca: rifiutata dal database',
  );
  expect(
    rejects(
      "INSERT INTO cards (id,workspace_id,board_id,column_id,title,position,priority,created_at,updated_at) VALUES ('bad2','w1','b3','c4','x',1,'none',1,1)",
    ),
    'scheda che punta a bacheca/colonna di un altro workspace: rifiutata',
  );
  run(
    `INSERT INTO custom_field_definitions (id,workspace_id,board_id,name,type,config,position,is_active,created_at,updated_at) VALUES ('f1','w1','b1','Reparto','text','{}',1,1,1,1)`,
  );
  expect(
    rejects(
      `INSERT INTO custom_field_definitions (id,workspace_id,board_id,name,type,config,position,is_active,created_at,updated_at) VALUES ('f2','w1','b1','REPARTO','text','{}',2,1,1,1)`,
    ),
    'nome di campo duplicato nella bacheca (senza distinzione di maiuscole): rifiutato',
  );
  expect(
    !rejects(
      `INSERT INTO custom_field_definitions (id,workspace_id,board_id,name,type,config,position,is_active,created_at,updated_at) VALUES ('f3','w1','b2','Reparto','text','{}',1,1,1,1)`,
    ),
    'lo stesso nome in un’altra bacheca è lecito',
  );
  expect(
    rejects(
      `INSERT INTO custom_field_values (card_id,field_id,workspace_id,value,updated_at) VALUES ('k1','f3','w1','"x"',1)`,
    ),
    'valore di un campo di un’altra bacheca su una scheda: rifiutato dal trigger',
  );
  expect(
    !rejects(
      `INSERT INTO custom_field_values (card_id,field_id,workspace_id,value,updated_at) VALUES ('k1','f1','w1','"x"',1)`,
    ),
    'valore di un campo della stessa bacheca: accettato',
  );
  console.log(`\nAggiornamento ${baseline.at(-1)} → ${last}: OK`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
