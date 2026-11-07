// Prova di aggiornamento 0005 → 0006 (M3 Tasks) su un database POPOLATO, con wrangler/D1 locale (workerd).
// Condizioni approvate (D-01, D-13): riuso della tabella `tasks`, migrazione ADDITIVA, nessuna ricostruzione.
//   1. conservazione integrale: ogni riga di ogni tabella preesistente identica; per `tasks`, le colonne
//      legacy identiche (compreso `due_at`) e le colonne nuove ai valori di default;
//   2. gli altri oggetti dello schema (tabelle, indici, trigger) identici prima e dopo;
//   3. foreign_key_check pulito (integrity_check non è consentito da D1); FK di `tasks` invariate (cascade);
//   4. PRESENZA DEI VINCOLI: ogni invariante violato di proposito è rifiutato dal motore;
//   5. isolamento: card di un altro workspace rifiutata; cascata alla cancellazione di card e workspace;
//   6. rollback: una riga legacy che viola un vincolo nuovo interrompe la migrazione SENZA schema parziale.
// Non tocca il repository né alcun database reale: tutto in una cartella temporanea.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'packages/database/migrations');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jobward-m3tasks-'));
const OWNER = 'owner@example.com';

const allFiles = fs
  .readdirSync(source)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const target = allFiles.find((f) => f.startsWith('0006'));
if (!target) throw new Error('Migrazione 0006 non trovata');
const baseline = allFiles.filter((f) => f < '0006'); // il database «di M3-C2»

const expect = (cond, message) => {
  if (!cond) throw new Error(`✖ ${message}`);
  console.log(`  ✓ ${message}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Una «installazione» locale isolata: cartella di migrazioni, stato D1 e configurazione wrangler. */
function install(name, files, overrides = {}) {
  const dir = path.join(tmp, name);
  const migrations = path.join(dir, 'migrations');
  const state = path.join(dir, 'state');
  fs.mkdirSync(migrations, { recursive: true });
  const config = path.join(dir, 'wrangler.jsonc');
  const api = {
    configure(next) {
      fs.writeFileSync(
        config,
        JSON.stringify({
          name: 'jobward-m3tasks-test',
          main: path.join(root, 'apps/api/src/index.ts'),
          compatibility_date: '2026-10-01',
          assets: {
            directory: path.join(root, 'apps/web/public'),
            binding: 'ASSETS',
            run_worker_first: ['/api/*'],
          },
          d1_databases: [
            {
              binding: 'DB',
              database_name: 'jobward-m3tasks',
              database_id: 'local-m3tasks',
              migrations_dir: migrations,
            },
          ],
          vars: {
            ENVIRONMENT: 'development',
            AUTH_MODE: 'dev',
            DEV_USER_EMAIL: OWNER,
            OWNER_EMAIL: '',
            ACCESS_TEAM_DOMAIN: '',
            ACCESS_AUD: '',
          },
          ...next,
        }),
      );
    },
    dir,
    migrations,
    state,
    config,
    put(file, content) {
      fs.writeFileSync(
        path.join(migrations, file),
        content ?? fs.readFileSync(path.join(source, file)),
      );
    },
    wrangler(args, { quiet = false } = {}) {
      const r = spawnSync(
        'pnpm',
        [
          '--filter',
          '@jobward/api',
          'exec',
          'wrangler',
          ...args,
          '--config',
          config,
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
    },
    query(sql) {
      const out = api.wrangler(['d1', 'execute', 'DB', '--local', '--json', '--command', sql]);
      return JSON.parse(out.slice(out.indexOf('[')))[0].results;
    },
    run(sql, options) {
      const file = path.join(dir, 'q.sql');
      fs.writeFileSync(file, sql);
      api.wrangler(['d1', 'execute', 'DB', '--local', '--file', file], options);
    },
    rejects(sql) {
      try {
        api.run(sql, { quiet: true });
        return false;
      } catch {
        return true;
      }
    },
    migrate(options) {
      api.wrangler(['d1', 'migrations', 'apply', 'DB', '--local'], options);
    },
  };
  api.configure(overrides);
  for (const f of files) api.put(f);
  return api;
}

const now = Date.now();
const POPULATE = `
  INSERT INTO users (id,email,display_name,created_at,updated_at) VALUES ('u1','${OWNER}','Ada',${now},${now}),('u2','b@example.com',NULL,${now},${now});
  INSERT INTO workspaces (id,name,timezone,created_at,updated_at) VALUES ('w1','Uno','Europe/Rome',${now},${now}),('w2','Due','UTC',${now},${now});
  INSERT INTO workspace_members (workspace_id,user_id,role,created_at) VALUES ('w1','u1','owner',${now}),('w2','u2','owner',${now});
  INSERT INTO boards (id,workspace_id,name,position,is_favorite,created_at,updated_at) VALUES ('b1','w1','Prima',1024,0,${now},${now}),('b3','w2','Altrui',1024,0,${now},${now});
  INSERT INTO board_columns (id,workspace_id,board_id,name,position,category,created_at,updated_at) VALUES
    ('c1','w1','b1','Salvate',1024,'saved',${now},${now}),('c4','w2','b3','Altrui',1024,NULL,${now},${now});
  INSERT INTO cards (id,workspace_id,board_id,column_id,title,description,position,priority,created_at,updated_at,archived_at) VALUES
    ('k1','w1','b1','c1','Infermiere','descrizione àèì',1024,'high',${now},${now},NULL),
    ('k4','w1','b1','c1','Archiviata',NULL,2048,'low',${now},${now},${now}),
    ('kx','w2','b3','c4','Riservata',NULL,1024,'high',${now},${now},NULL);
  INSERT INTO application_details (card_id,workspace_id,company,stage,outcome,applied_on,created_at,updated_at) VALUES
    ('k1','w1','Acme','applied','pending','2026-10-01',${now},${now});
  INSERT INTO labels (id,workspace_id,name,color,created_at) VALUES ('l1','w1','Interessante','green',${now});
  INSERT INTO card_labels (card_id,label_id,workspace_id) VALUES ('k1','l1','w1');
  INSERT INTO interviews (id,workspace_id,card_id,sequence,title,type,status,scheduled_at,timezone,interviewers,feedback_notes,result,completed_at,created_at,updated_at) VALUES
    ('i1','w1','k1',1,'Screening','screening','completed',${now - 5000},'UTC','["Mario"]','ottimo','positive',${now - 4000},${now},${now});
  INSERT INTO tasks (id,workspace_id,card_id,title,description,due_at,completed_at,priority,created_at,updated_at) VALUES
    ('t1','w1','k1','Ricontattare','da fare',${now + 1000},NULL,'high',${now},${now}),
    ('t2','w1',NULL,'Libera',NULL,NULL,NULL,'none',${now},${now}),
    ('t3','w1','k1','Completata legacy',NULL,${now - 9000},${now - 5000},'low',${now},${now}),
    ('t4','w2',NULL,'Altrui',NULL,NULL,NULL,'none',${now},${now}),
    ('t5','w1','k4','Su archiviata','x',NULL,NULL,'medium',${now},${now});
`;

const LEGACY_TASK_COLUMNS =
  'id,workspace_id,card_id,title,description,due_at,completed_at,priority,created_at,updated_at';
const tablesOf = (db) =>
  db
    .query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name",
    )
    .map((r) => r.name);
const dump = (db) =>
  Object.fromEntries(
    tablesOf(db).map((t) => [
      t,
      db.query(`SELECT ${t === 'tasks' ? LEGACY_TASK_COLUMNS : '*'} FROM ${t} ORDER BY rowid`),
    ]),
  );
const objectsExceptTasks = (db) =>
  db
    .query(
      "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' AND tbl_name <> 'tasks' ORDER BY type,name",
    )
    .map((o) => ({
      ...o,
      sql: String(o.sql ?? '')
        .replaceAll(/\s+/g, ' ')
        .trim(),
    }));
const cols = (db) => db.query('PRAGMA table_info(tasks)').map((c) => c.name);
const idx = (db) =>
  db
    .query('PRAGMA index_list(tasks)')
    .map((i) => i.name)
    .filter((n) => !n.startsWith('sqlite_'))
    .sort();

console.log(`\n== 0005 popolato → ${target} ==`);
const up = install('up', baseline);
up.migrate();
up.run(POPULATE);
const before = dump(up);
const objectsBefore = objectsExceptTasks(up);
const colsBefore = cols(up);
const fkBefore = up
  .query('PRAGMA foreign_key_list(tasks)')
  .map((f) => [f.table, f.from, f.to, f.on_delete, f.on_update]);
expect(
  cols(up).length === 10 && !cols(up).includes('kind'),
  'prima: tasks ha le 10 colonne di 0001 e nessuna colonna nuova',
);
expect(
  before.tasks.length === 5,
  'prima: 5 task legacy (con e senza card/due_at, completata, di due workspace)',
);

up.put(target);
up.migrate();
const after = dump(up);

for (const t of Object.keys(before))
  expect(same(before[t], after[t]), `conservazione: ${t} identica (${before[t].length} righe)`);
expect(
  same(objectsBefore, objectsExceptTasks(up)),
  'tutti gli altri oggetti dello schema (tabelle, indici, trigger) identici',
);
expect(
  same(cols(up).slice(0, 10), colsBefore) &&
    cols(up).slice(10).sort().join() === 'cancelled_at,due_on,kind,request_fingerprint' &&
    cols(up).length === 14,
  'tasks: aggiunte esattamente kind, due_on, cancelled_at, request_fingerprint (nessuna colonna tolta o riordinata)',
);
const legacy = up.query(
  'SELECT id,kind,due_on,cancelled_at,request_fingerprint,due_at FROM tasks ORDER BY id',
);
expect(
  legacy.every(
    (r) =>
      r.kind === 'general' &&
      r.due_on === null &&
      r.cancelled_at === null &&
      r.request_fingerprint === null,
  ),
  'righe preesistenti: kind = general e colonne nuove NULL (nessun backfill)',
);
expect(legacy.find((r) => r.id === 't1').due_at > 0, 'la colonna legacy due_at è conservata');
expect(
  same(idx(up), ['tasks_card_idx', 'tasks_done_idx', 'tasks_open_due_idx']),
  'indici di tasks: rimosso quello basato su due_at, aggiunti i due parziali, tasks_card_idx conservato',
);
expect(
  same(
    up
      .query('PRAGMA foreign_key_list(tasks)')
      .map((f) => [f.table, f.from, f.to, f.on_delete, f.on_update]),
    fkBefore,
  ),
  'FK di tasks invariate (stesse azioni ON DELETE/ON UPDATE)',
);
expect(up.query('PRAGMA foreign_key_check').length === 0, 'foreign_key_check pulito');
// PRAGMA integrity_check non è consentito da D1 (SQLITE_AUTH): non c'è nemmeno in produzione.
const sqlOnly = fs
  .readFileSync(path.join(source, target), 'utf8')
  .split('\n')
  .filter((l) => !l.startsWith('--'))
  .join('\n');
expect(
  !/DROP TABLE|PRAGMA|CREATE TRIGGER|INSERT INTO|UPDATE /i.test(sqlOnly),
  `${target} non ricostruisce tabelle, non usa PRAGMA né trigger e non copia né altera righe`,
);

console.log('\n== presenza dei vincoli (ogni violazione deve essere rifiutata dal motore) ==');
const ins = (extra = '', values = '') =>
  `INSERT INTO tasks (id,workspace_id,title,created_at,updated_at${extra}) VALUES ('n${Math.random().toString(36).slice(2, 9)}','w1','t',1,1${values})`;
const bad = {
  'titolo vuoto': `INSERT INTO tasks (id,workspace_id,title,created_at,updated_at) VALUES ('x1','w1','',1,1)`,
  'titolo di 201 caratteri': `INSERT INTO tasks (id,workspace_id,title,created_at,updated_at) VALUES ('x2','w1','${'a'.repeat(201)}',1,1)`,
  'descrizione di 2001 caratteri': ins(',description', `,'${'a'.repeat(2001)}'`),
  'kind non valido': ins(',kind', ",'altro'"),
  'priority non valida': ins(',priority', ",'boh'"),
  'due_on impossibile (30 febbraio)': ins(',due_on', ",'2026-02-30'"),
  'due_on con orario': ins(',due_on', ",'2026-02-10T10:00'"),
  'due_on malformata': ins(',due_on', ",'10/02/2026'"),
  'completata e annullata insieme': ins(',completed_at,cancelled_at', ',1,2'),
  'fingerprint di lunghezza errata': ins(',request_fingerprint', ",'abc'"),
  'card di un altro workspace': `INSERT INTO tasks (id,workspace_id,card_id,title,created_at,updated_at) VALUES ('x3','w1','kx','t',1,1)`,
  'card inesistente': `INSERT INTO tasks (id,workspace_id,card_id,title,created_at,updated_at) VALUES ('x4','w1','nope','t',1,1)`,
  'workspace inesistente': `INSERT INTO tasks (id,workspace_id,title,created_at,updated_at) VALUES ('x5','nope','t',1,1)`,
  'UPDATE verso lo stato incoerente': `UPDATE tasks SET completed_at = 5, cancelled_at = 6 WHERE id = 't2'`,
  'UPDATE che svuota il titolo': `UPDATE tasks SET title = '' WHERE id = 't2'`,
  'UPDATE verso una data impossibile': `UPDATE tasks SET due_on = '2026-13-01' WHERE id = 't2'`,
};
for (const [name, sql] of Object.entries(bad)) expect(up.rejects(sql), `rifiutato: ${name}`);
up.run(`INSERT INTO tasks (id,workspace_id,card_id,title,kind,due_on,priority,request_fingerprint,created_at,updated_at)
        VALUES ('ok1','w1','k1','Valida','follow_up','2028-02-29','urgent','${'a'.repeat(64)}',1,1)`);
expect(
  up.query("SELECT kind,due_on FROM tasks WHERE id='ok1'")[0].due_on === '2028-02-29',
  'accettata: task valida (follow_up, 29 febbraio bisestile)',
);
up.run(`UPDATE tasks SET cancelled_at = 9 WHERE id = 'ok1'`);
expect(
  up.query("SELECT cancelled_at FROM tasks WHERE id='ok1'")[0].cancelled_at === 9,
  'accettato: annullamento',
);

console.log('\n== cascate e isolamento ==');
up.run(`DELETE FROM cards WHERE id = 'k1'`);
expect(
  up.query("SELECT count(*) AS n FROM tasks WHERE card_id = 'k1'")[0].n === 0,
  'cancellando una card cadono le sue task (nessun riferimento pendente)',
);
expect(
  up.query("SELECT count(*) AS n FROM tasks WHERE id IN ('t2','t4','t5')")[0].n === 3,
  'le task di workspace e delle altre card restano',
);
up.run(`DELETE FROM workspaces WHERE id = 'w2'`);
expect(
  up.query("SELECT count(*) AS n FROM tasks WHERE workspace_id = 'w2'")[0].n === 0,
  'cancellando un workspace cadono le sue task',
);
expect(
  up.query("SELECT count(*) AS n FROM tasks WHERE workspace_id = 'w1'")[0].n >= 1,
  'le task degli altri workspace restano',
);
expect(
  up.query('PRAGMA foreign_key_check').length === 0,
  'foreign_key_check pulito dopo le cascate',
);

console.log(
  '\n== rollback: una riga legacy che viola un vincolo nuovo interrompe la migrazione ==',
);
const rb = install('rollback', baseline);
rb.migrate();
rb.run(POPULATE);
rb.run(
  `INSERT INTO tasks (id,workspace_id,title,created_at,updated_at) VALUES ('legacy-bad','w1','',1,1)`,
);
const rbBefore = dump(rb);
const rbCols = cols(rb);
const rbIdx = idx(rb);
rb.put(target);
let failed = false;
try {
  rb.migrate({ quiet: true });
} catch {
  failed = true;
}
expect(failed, 'la migrazione si interrompe (non corregge in silenzio)');
expect(same(cols(rb), rbCols), 'nessuno schema parziale: colonne di tasks invariate');
expect(same(idx(rb), rbIdx), 'nessuno schema parziale: indici di tasks invariati');
expect(same(dump(rb), rbBefore), 'nessun dato perso né modificato');
expect(
  rb.query("SELECT count(*) AS n FROM d1_migrations WHERE name LIKE '0006%'")[0].n === 0,
  '0006 non risulta applicata',
);
rb.run(`DELETE FROM tasks WHERE id = 'legacy-bad'`);
rb.migrate();
expect(
  rb.query("SELECT count(*) AS n FROM d1_migrations WHERE name LIKE '0006%'")[0].n === 1,
  'corretta la riga, la stessa migrazione si applica',
);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nAggiornamento 0005 → ${target}: OK`);
