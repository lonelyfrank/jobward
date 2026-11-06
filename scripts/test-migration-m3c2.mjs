// Prova di aggiornamento M2.5 → 0005 (M3-C2) su un database POPOLATO, con wrangler/D1 locale.
// Condizioni D4 di docs/m3/plan.md §1.1:
//   1. conservazione integrale: ogni riga di ogni tabella preesistente identica, campo per campo
//      (activity_events: stessi ID, riferimenti, tipi, metadati, timestamp; colonne nuove = NULL);
//   2. inventario prima/dopo di chiavi esterne (con ON DELETE/ON UPDATE), indici, trigger;
//   3. foreign_key_check e integrity_check puliti; rifiuto di riferimenti fra workspace;
//   4. rollback: un errore durante la copia (o dopo) non lascia uno schema parziale né perde dati;
//   5. API reale sul database aggiornato: chiusura → riapertura, evento `application_reopened`,
//      lettura nella timeline, retry = un solo evento, nuova riapertura = nuovo evento.
// Non tocca il repository né alcun database reale: tutto in una cartella temporanea.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'packages/database/migrations');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jobward-m3c2-'));
const OWNER = 'owner@example.com';

const allFiles = fs
  .readdirSync(source)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const target = allFiles.find((f) => f.startsWith('0005'));
if (!target) throw new Error('Migrazione 0005 non trovata');
const baseline = allFiles.filter((f) => f < '0005'); // il database «di M2.5»

const expect = (cond, message) => {
  if (!cond) throw new Error(`✖ ${message}`);
  console.log(`  ✓ ${message}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const norm = (s) =>
  String(s ?? '')
    .replaceAll(/\s+/g, ' ')
    .trim();

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
          name: 'jobward-m3c2-test',
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
              database_name: 'jobward-m3c2',
              database_id: 'local-m3c2',
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
  INSERT INTO boards (id,workspace_id,name,position,is_favorite,created_at,updated_at) VALUES ('b1','w1','Prima',1024,0,${now},${now}),('b2','w1','Seconda',2048,1,${now},${now}),('b3','w2','Altrui',1024,0,${now},${now});
  INSERT INTO board_columns (id,workspace_id,board_id,name,position,category,created_at,updated_at) VALUES
    ('c1','w1','b1','Salvate',1024,'saved',${now},${now}),('c2','w1','b1','Colloquio',2048,'interviewing',${now},${now}),
    ('c3','w1','b2','Altre',1024,NULL,${now},${now}),('c4','w2','b3','Altrui',1024,NULL,${now},${now});
  INSERT INTO cards (id,workspace_id,board_id,column_id,title,description,position,priority,created_at,updated_at,archived_at) VALUES
    ('k1','w1','b1','c1','Infermiere','descrizione àèì',1024,'high',${now},${now},NULL),
    ('k2','w1','b1','c1','Rifiutata',NULL,2048,'none',${now},${now},NULL),
    ('k3','w1','b1','c2','Assunto',NULL,1024,'urgent',${now},${now},NULL),
    ('k4','w1','b1','c2','Archiviata',NULL,2048,'low',${now},${now},${now}),
    ('k5','w1','b2','c3','Senza dettagli',NULL,1024,'medium',${now},${now},NULL),
    ('k6','w1','b1','c1','Chiusa senza esito',NULL,3072,'none',${now},${now},NULL),
    ('kx','w2','b3','c4','Riservata',NULL,1024,'high',${now},${now},NULL);
  INSERT INTO application_details (card_id,workspace_id,company,stage,outcome,applied_on,created_at,updated_at) VALUES
    ('k1','w1','Acme','applied','pending','2026-10-01',${now},${now}),
    ('k2','w1','Beta','closed','rejected','2026-09-01',${now},${now}),
    ('k3','w1','Gamma','closed','accepted','2026-08-01',${now},${now}),
    ('k4','w1','Delta','interviewing','pending',NULL,${now},${now}),
    ('k6','w1','Eta','closed',NULL,NULL,${now},${now}),
    ('kx','w2','Segreta','offer','pending',NULL,${now},${now});
  INSERT INTO labels (id,workspace_id,name,color,created_at) VALUES ('l1','w1','Interessante','green',${now});
  INSERT INTO card_labels (card_id,label_id,workspace_id) VALUES ('k1','l1','w1');
  INSERT INTO tasks (id,workspace_id,card_id,title,due_at,priority,created_at,updated_at) VALUES ('t1','w1','k1','Ricontattare',${now + 1000},'none',${now},${now}),('t2','w1',NULL,'Libera',NULL,'none',${now},${now});
  INSERT INTO custom_field_definitions (id,workspace_id,board_id,name,type,config,position,is_active,created_at,updated_at) VALUES ('f1','w1','b1','Reparto','text','{}',1,1,${now},${now});
  INSERT INTO custom_field_values (card_id,field_id,workspace_id,value,updated_at) VALUES ('k1','f1','w1','"Cardiologia"',${now});
  INSERT INTO interviews (id,workspace_id,card_id,sequence,title,type,status,scheduled_at,timezone,interviewers,feedback_notes,result,completed_at,created_at,updated_at) VALUES
    ('i1','w1','k1',1,'Screening','screening','completed',${now - 5000},'UTC','["Mario"]','ottimo','positive',${now - 4000},${now},${now}),
    ('i2','w1','k1',2,'Tecnico','technical','scheduled',${now + 86400000},'Europe/Rome','[]',NULL,NULL,NULL,${now},${now}),
    ('i3','w1','k1',3,'Annullato','other','cancelled',NULL,NULL,'[]',NULL,NULL,NULL,${now},${now}),
    ('i4','w1','k4',1,'Su archiviata','final','to_schedule',NULL,NULL,'[]',NULL,NULL,NULL,${now},${now});
  INSERT INTO activity_events (id,workspace_id,board_id,card_id,actor_user_id,type,metadata,occurred_at) VALUES
    ('e01','w1','b1','k1','u1','card_created','{"columnName":"Salvate"}',${now}),
    ('e02','w1','b1','k1','u1','card_moved','{"toColumnName":"Colloquio"}',${now + 1}),
    ('e03','w1','b1','k1','u1','card_archived','{}',${now + 2}),
    ('e04','w1','b1','k1','u1','card_restored','{}',${now + 3}),
    ('e05','w1','b1','k1','u1','stage_changed','{"from":null,"to":"applied"}',${now + 4}),
    ('e06','w1','b1','k1',NULL,'priority_changed','{"from":"none","to":"high"}',${now + 5}),
    ('e07','w1','b1','k1','u1','application_submitted','{"appliedOn":"2026-10-01"}',${now + 6}),
    ('e08','w1','b1','k1','u1','contact_logged','{}',${now + 7}),
    ('e09','w1','b1','k1','u1','task_added','{"taskId":"t1"}',${now + 8}),
    ('e10','w1','b1','k1','u1','task_completed','{"taskId":"t1"}',${now + 9}),
    ('e11','w1','b1','k2','u1','application_closed','{"outcome":"rejected"}',${now + 10}),
    ('e12','w1','b1','k1','u1','interview_created','{"interviewId":"i1","sequence":1}',${now + 11}),
    ('e13','w1','b1','k1','u1','interview_next_round_created','{"interviewId":"i2","sequence":2,"previousSequence":1}',${now + 12}),
    ('e14','w1','b1','k1','u1','interview_rescheduled','{"interviewId":"i2","from":1,"to":2}',${now + 13}),
    ('e15','w1','b1','k1','u1','interview_completed','{"interviewId":"i1","result":"positive"}',${now + 14}),
    ('e16','w1','b1','k1','u1','interview_cancelled','{"interviewId":"i3"}',${now + 15}),
    ('e17','w1','b1','k1','u1','interview_feedback_recorded','{"interviewId":"i1","result":"positive"}',${now + 16}),
    ('e18','w1',NULL,NULL,NULL,'card_created','{"orfano":true}',${now + 17}),
    ('e19','w2','b3','kx','u2','card_created','{}',${now + 18});
`;

// --- inventario e istantanea -----------------------------------------------------------------
const TABLES_SQL =
  "SELECT m.name AS t, p.name AS c FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type='table' AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE '_cf_%' AND m.name NOT LIKE 'd1_%' ORDER BY m.name, p.cid";
function columnsByTable(inst) {
  const map = {};
  for (const { t, c } of inst.query(TABLES_SQL)) (map[t] ??= []).push(c);
  return map;
}
/** Tutte le righe delle tabelle indicate, solo con le colonne indicate, in ordine deterministico. */
function snapshot(inst, columns) {
  const parts = Object.entries(columns).map(([t, cols]) => {
    const pairs = cols.map((c) => `'${c}', "${c}"`).join(', ');
    const order = cols.map((_, i) => i + 1).join(', ');
    return `(SELECT json_group_array(json_object(${pairs})) FROM (SELECT ${cols.map((c) => `"${c}"`).join(', ')} FROM "${t}" ORDER BY ${order})) AS "${t}"`;
  });
  const row = inst.query(`SELECT ${parts.join(', ')}`)[0];
  return Object.fromEntries(Object.entries(row).map(([t, json]) => [t, JSON.parse(json)]));
}
function inventory(inst) {
  return {
    // D1 vieta le funzioni pragma_* come tabelle: le FK si leggono dal DDL (colonne, riferimenti e
    // azioni ON UPDATE/ON DELETE), più il PRAGMA vero e proprio per la tabella ricostruita.
    fks: inst
      .query("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name")
      .flatMap((t) =>
        [
          ...String(t.sql).matchAll(
            /FOREIGN KEY\s*\(([^)]*)\)\s*REFERENCES\s*`?(\w+)`?\s*\(([^)]*)\)([^,)]*)/gi,
          ),
        ].map((m) =>
          JSON.stringify({
            tbl: t.name,
            fromCol: norm(m[1]),
            refTable: m[2],
            toCol: norm(m[3]),
            actions: norm(m[4]).toUpperCase(),
          }),
        ),
      )
      .sort(),
    eventFks: inst
      .query('PRAGMA foreign_key_list(activity_events)')
      .map((r) =>
        JSON.stringify({
          from: r.from,
          table: r.table,
          to: r.to,
          onUpdate: r.on_update,
          onDelete: r.on_delete,
        }),
      )
      .sort(),
    indexes: inst
      .query(
        "SELECT name, tbl_name AS tbl, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name",
      )
      .map((r) => ({ ...r, sql: norm(r.sql) })),
    triggers: inst
      .query(
        "SELECT name, tbl_name AS tbl, sql FROM sqlite_master WHERE type='trigger' ORDER BY name",
      )
      .map((r) => ({ ...r, sql: norm(r.sql) })),
    tables: inst
      .query(
        "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name",
      )
      .map((r) => ({ ...r, sql: norm(r.sql) })),
  };
}

let server = null;
try {
  // ---------------------------------------------------------------------------------------------
  console.log(`1. Database M2.5 popolato: ${baseline.join(', ')}`);
  const base = install('base', baseline);
  base.migrate();
  base.run(POPULATE);
  const columnsBefore = columnsByTable(base);
  const dataBefore = snapshot(base, columnsBefore);
  const invBefore = inventory(base);
  const counts = Object.fromEntries(
    Object.entries(dataBefore).map(([t, rows]) => [t, rows.length]),
  );
  console.log(
    `   ${Object.keys(counts).length} tabelle; ${counts.cards} schede, ${counts.activity_events} eventi, ${counts.interviews} colloqui`,
  );
  expect(
    counts.activity_events === 19 && counts.cards === 7,
    'fixture popolata (2 workspace, 17 tipi di evento, schede aperte/chiuse/archiviate)',
  );
  const types = new Set(dataBefore.activity_events.map((e) => e.type));
  expect(types.size === 17, 'ogni tipo di evento di M2.5 è presente nella fixture');

  // Copie dello stato M2.5 POPOLATO (prima di qualunque migrazione): stesso database_id, quindi
  // trasferibili. Servono alle prove di rollback e all'API reale.
  const copyState = (name) => {
    const inst = install(name, baseline);
    fs.cpSync(base.state, inst.state, { recursive: true });
    return inst;
  };
  const midCopy = copyState('rollback-copy');
  const late = copyState('rollback-late');
  const live = copyState('live');

  // ---------------------------------------------------------------------------------------------
  console.log(
    '2. Rollback: errore DURANTE la copia (la guardia deve fermare la migrazione prima del DROP)',
  );
  const sqlTarget = fs.readFileSync(path.join(source, target), 'utf8');
  const lossy = sqlTarget.replace(
    'FROM `activity_events`;--> statement-breakpoint\nCREATE TABLE `_m3c2_guard`',
    "FROM `activity_events` WHERE `id` <> 'e01';--> statement-breakpoint\nCREATE TABLE `_m3c2_guard`",
  );
  expect(lossy !== sqlTarget, 'variante con copia incompleta preparata');
  midCopy.put(target, lossy);
  expect(midCopy.rejects('SELECT 1') === false, 'database copiato apribile');
  let failed = false;
  try {
    midCopy.migrate({ quiet: true });
  } catch {
    failed = true;
  }
  expect(failed, 'la migrazione con copia incompleta FALLISCE');
  const afterMid = snapshot(midCopy, columnsBefore);
  expect(
    same(afterMid, dataBefore),
    'nessun dato perso o alterato dopo il fallimento (tutte le tabelle)',
  );
  expect(
    same(inventory(midCopy), invBefore),
    'schema identico a prima: nessun residuo parziale (tabelle, indici, trigger, FK)',
  );
  expect(
    midCopy.query(
      "SELECT count(*) n FROM sqlite_master WHERE name IN ('card_notes','card_documents','__new_activity_events','_m3c2_guard')",
    )[0].n === 0,
    'nessuna tabella nuova, temporanea o di guardia rimasta',
  );

  console.log('3. Rollback: errore DOPO la ricostruzione (ultima istruzione)');
  late.put(
    target,
    `${sqlTarget}\n--> statement-breakpoint\nINSERT INTO tabella_inesistente VALUES (1);\n`,
  );
  failed = false;
  try {
    late.migrate({ quiet: true });
  } catch {
    failed = true;
  }
  expect(failed, 'la migrazione con errore finale FALLISCE');
  expect(same(snapshot(late, columnsBefore), dataBefore), 'dati identici a prima');
  expect(
    same(inventory(late), invBefore),
    'schema identico a prima (transazione annullata per intero)',
  );
  late.put(target); // ripristino la migrazione vera: ora deve riuscire sullo stesso database
  late.migrate();
  expect(
    late.query('SELECT count(*) n FROM activity_events')[0].n === 19,
    'dopo il ripristino la migrazione riesce e conserva i 19 eventi',
  );

  // ---------------------------------------------------------------------------------------------
  console.log(`4. Aggiornamento ${target}`);
  base.put(target);
  base.migrate();

  console.log('   4a. Conservazione integrale dei dati');
  const columnsAfter = columnsByTable(base);
  const dataAfter = snapshot(base, columnsBefore); // solo le colonne PREESISTENTI
  for (const table of Object.keys(columnsBefore)) {
    expect(
      same(dataAfter[table], dataBefore[table]),
      `${table}: ${dataBefore[table].length} righe identiche, campo per campo`,
    );
  }
  expect(
    same(
      dataAfter.activity_events.map((e) => e.id),
      dataBefore.activity_events.map((e) => e.id),
    ),
    'activity_events: stessi ID',
  );
  expect(
    base.query(
      'SELECT count(*) n FROM activity_events WHERE dedupe_key IS NOT NULL OR operation_id IS NOT NULL OR request_fingerprint IS NOT NULL',
    )[0].n === 0,
    'eventi preesistenti: dedupe_key, operation_id e request_fingerprint = NULL',
  );
  expect(
    base.query('SELECT count(*) n FROM interviews WHERE request_fingerprint IS NOT NULL')[0].n ===
      0,
    'colloqui preesistenti: request_fingerprint = NULL (nessun backfill)',
  );
  expect(
    same(
      columnsAfter.activity_events.slice(0, columnsBefore.activity_events.length),
      columnsBefore.activity_events,
    ) &&
      columnsAfter.activity_events.slice(columnsBefore.activity_events.length).join() ===
        'dedupe_key,operation_id,request_fingerprint',
    'activity_events: colonne preesistenti nello stesso ordine + le tre nuove',
  );
  expect(
    columnsAfter.card_notes &&
      columnsAfter.card_documents &&
      base.query('SELECT count(*) n FROM card_notes')[0].n === 0,
    'tabelle card_notes e card_documents create vuote',
  );

  console.log('   4b. Inventario di chiavi esterne, indici e trigger (prima/dopo)');
  const invAfter = inventory(base);
  const before = new Set(Object.keys(columnsBefore));
  expect(
    same(
      invAfter.fks.filter((r) => before.has(JSON.parse(r).tbl)),
      invBefore.fks,
    ),
    `chiavi esterne delle ${before.size} tabelle preesistenti identiche (colonne, riferimenti, ON DELETE/ON UPDATE): ${invBefore.fks.length}`,
  );
  const newFks = invAfter.fks.map((r) => JSON.parse(r)).filter((r) => !before.has(r.tbl));
  expect(
    same(invAfter.eventFks, invBefore.eventFks) && invBefore.eventFks.length === 4,
    'PRAGMA foreign_key_list(activity_events): 4 chiavi identiche (workspace CASCADE; bacheca, scheda, autore SET NULL)',
  );
  expect(
    newFks.length === 4 &&
      newFks.every((f) => /ON UPDATE NO ACTION ON DELETE CASCADE/.test(f.actions)) &&
      ['card_notes', 'card_documents'].every(
        (t) =>
          newFks
            .filter((f) => f.tbl === t)
            .map((f) => f.refTable)
            .sort()
            .join() === 'cards,workspaces',
      ),
    'FK nuove: note e documenti → workspace e scheda (composita), tutte ON DELETE CASCADE',
  );
  expect(
    same(invAfter.triggers, invBefore.triggers),
    `trigger identici (${invBefore.triggers.map((t) => t.name).join(', ')}): ricreati senza modifiche`,
  );
  const keep = (list) => list.filter((i) => i.tbl !== 'activity_events' && before.has(i.tbl));
  expect(
    same(keep(invAfter.indexes), keep(invBefore.indexes)),
    'indici delle altre tabelle identici',
  );
  const oldIdx = invBefore.indexes.filter((i) => i.tbl === 'activity_events');
  expect(
    oldIdx.length === 2 && oldIdx.every((o) => invAfter.indexes.some((n) => same(n, o))),
    'indici preesistenti di activity_events ricreati identici',
  );
  expect(
    ['activity_events_dedupe_unique', 'activity_events_operation_idx'].every((n) =>
      invAfter.indexes.some((i) => i.name === n && /WHERE/i.test(i.sql)),
    ),
    'indici parziali nuovi: dedupe_key univoca per workspace, operation_id',
  );
  const otherTables = (list) =>
    list.filter((t) => before.has(t.name) && !['activity_events', 'interviews'].includes(t.name));
  expect(
    same(otherTables(invAfter.tables), otherTables(invBefore.tables)),
    'DDL delle altre tabelle preesistenti invariato',
  );
  expect(
    base.query('PRAGMA foreign_key_check').length === 0,
    'foreign_key_check: nessuna violazione',
  );
  // PRAGMA integrity_check non è consentito da D1 (SQLITE_AUTH): non c'è nemmeno in produzione.
  expect(
    ['dedupe_key', 'operation_id', 'request_fingerprint'].every((c) =>
      columnsAfter.activity_events.includes(c),
    ) &&
      !base.query(
        "SELECT name FROM sqlite_master WHERE name LIKE '\\_\\_new%' ESCAPE '\\' OR name LIKE '\\_m3c2%' ESCAPE '\\'",
      ).length,
    'nessuna tabella temporanea rimasta',
  );

  console.log('   4c. Vincoli dopo l’aggiornamento');
  const ev = (id, extra = {}) => {
    const v = {
      ws: 'w1',
      board: "'b1'",
      card: "'k1'",
      actor: "'u1'",
      type: 'card_created',
      key: 'NULL',
      op: 'NULL',
      fp: 'NULL',
      ...extra,
    };
    return `INSERT INTO activity_events (id,workspace_id,board_id,card_id,actor_user_id,type,metadata,occurred_at,dedupe_key,operation_id,request_fingerprint) VALUES ('${id}','${v.ws}',${v.board},${v.card},${v.actor},'${v.type}','{}',1,${v.key},${v.op},${v.fp})`;
  };
  const FP = `'${'a'.repeat(64)}'`;
  expect(
    !base.rejects(
      ev('n1', {
        type: 'application_reopened',
        key: '\'["application_reopened","card","k1","op1"]\'',
        op: "'op1'",
        fp: FP,
      }),
    ),
    'accetta il nuovo tipo application_reopened',
  );
  expect(base.rejects(ev('n2', { type: 'inventato' })), 'rifiuta un tipo di evento sconosciuto');
  expect(
    base.rejects(
      ev('n3', {
        type: 'application_reopened',
        key: '\'["application_reopened","card","k1","op1"]\'',
        op: "'op1'",
        fp: FP,
      }),
    ),
    'dedupe_key duplicata nello stesso workspace: rifiutata dall’indice univoco',
  );
  expect(
    base.rejects(
      ev('n3b', {
        card: "'kx'",
        board: "'b3'",
        actor: 'NULL',
        key: "'altra-chiave'",
        op: "'op9'",
        fp: FP,
      }),
    ),
    'evento di w1 che punta a una scheda di w2: rifiutato dal trigger ricreato',
  );
  expect(
    !base.rejects(
      ev('n4', {
        ws: 'w2',
        board: "'b3'",
        card: "'kx'",
        actor: "'u2'",
        key: '\'["application_reopened","card","k1","op1"]\'',
        op: "'op1'",
        fp: FP,
      }),
    ),
    'la stessa chiave in un altro workspace è lecita (scope per workspace)',
  );
  expect(
    !base.rejects(ev('n5')) && !base.rejects(ev('n6')),
    'eventi senza chiave: illimitati (NULL non collide)',
  );
  expect(base.rejects(ev('n7', { op: "'solo-op'" })), 'operation_id senza fingerprint: rifiutato');
  expect(base.rejects(ev('n8', { key: "'k'" })), 'dedupe_key senza operation_id: rifiutata');
  const note = (id, o = {}) => {
    const v = { ws: 'w1', card: 'k1', body: 'ciao', fp: FP, del: 'NULL', ...o };
    return `INSERT INTO card_notes (id,workspace_id,card_id,body,request_fingerprint,created_at,updated_at,deleted_at) VALUES ('${id}','${v.ws}','${v.card}','${v.body}',${v.fp},1,1,${v.del})`;
  };
  expect(!base.rejects(note('nt1')), 'nota valida su una scheda del proprio workspace');
  expect(
    base.rejects(note('nt2', { ws: 'w2' })),
    'nota con scheda di un altro workspace: rifiutata dalla chiave composita',
  );
  expect(base.rejects(note('nt3', { body: '' })), 'nota vuota: rifiutata');
  expect(base.rejects(note('nt4', { fp: 'NULL' })), 'nota viva senza fingerprint: rifiutata');
  expect(
    !base.rejects(note('nt5', { body: '', fp: 'NULL', del: '5' })),
    'lapide (testo vuoto, senza fingerprint): accettata',
  );
  expect(
    base.rejects(note('nt6', { body: 'residuo', fp: 'NULL', del: '5' })),
    'lapide che conserva il testo: rifiutata',
  );
  const doc = (id, o = {}) => {
    const v = { ws: 'w1', card: 'k1', kind: 'cv', url: 'NULL', ...o };
    return `INSERT INTO card_documents (id,workspace_id,card_id,title,kind,url,request_fingerprint,created_at,updated_at) VALUES ('${id}','${v.ws}','${v.card}','t','${v.kind}',${v.url},${FP},1,1)`;
  };
  expect(
    !base.rejects(doc('d1', { url: "'https://example.com/cv'" })),
    'documento con URL https: accettato',
  );
  expect(
    base.rejects(doc('d2', { url: "'javascript:alert(1)'" })),
    'URL con schema pericoloso: rifiutato dal database',
  );
  expect(
    base.rejects(doc('d3', { kind: 'virus' })),
    'tipo di documento fuori vocabolario: rifiutato',
  );
  expect(
    base.rejects(doc('d4', { ws: 'w2' })),
    'documento con scheda di un altro workspace: rifiutato',
  );
  base.run("DELETE FROM cards WHERE id='k1'");
  expect(
    base.query(
      "SELECT (SELECT count(*) FROM card_notes WHERE card_id='k1') + (SELECT count(*) FROM interviews WHERE card_id='k1') AS n",
    )[0].n === 0 &&
      base.query("SELECT count(*) n FROM activity_events WHERE id='e01' AND card_id IS NULL")[0]
        .n === 1,
    'eliminando la scheda: note e colloqui seguono (cascata); la cronologia sopravvive con card_id = NULL',
  );

  // ---------------------------------------------------------------------------------------------
  console.log('5. API reale sul database aggiornato (wrangler dev): chiusura → riapertura');
  // `live` è la copia del database M2.5 popolato, aggiornata come farebbe un utente.
  live.put(target);
  live.migrate();
  const port = 8800 + Math.floor(Math.random() * 100);
  server = spawn(
    'pnpm',
    [
      '--filter',
      '@jobward/api',
      'exec',
      'wrangler',
      'dev',
      '--config',
      live.config,
      '--persist-to',
      live.state,
      '--port',
      String(port),
      '--inspector-port',
      String(port + 500),
    ],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));
  const url = (p) =>
    `http://localhost:${port}/api/v1${p}${p.includes('?') ? '&' : '?'}workspaceId=w1`;
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/api/health`)).ok) break;
    } catch {
      /* non ancora pronto */
    }
    if (i > 120) throw new Error(`wrangler dev non risponde:\n${serverLog.slice(-1500)}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  const api = async (method, p, json) => {
    const res = await fetch(url(p), {
      method,
      headers: { 'content-type': 'application/json' },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  const timeline = async () => (await api('GET', '/cards/k2/timeline?limit=50')).body.entries;
  const countKind = async (kind) => (await timeline()).filter((e) => e.kind === kind).length;

  const legacy = await timeline();
  expect(
    legacy.some((e) => e.kind === 'application_closed') && legacy.length >= 1,
    'la cronologia preesistente (k2: «Rifiutata») si legge nella timeline',
  );
  const detail = await api('GET', '/cards/k2');
  expect(
    detail.status === 200 && detail.body.card.outcome === 'rejected',
    'la scheda legacy si legge come prima (esito Rifiutata)',
  );

  const reopen = {
    id: 'reopen-op-0000000001',
    to: 'applied',
    kind: 'reopen',
    expectedFrom: 'rejected',
  };
  const r1 = await api('POST', '/cards/k2/pipeline', reopen);
  expect(
    r1.status === 200 &&
      r1.body.replayed === false &&
      r1.body.card.outcome === 'pending' &&
      r1.body.card.stage === 'applied',
    'riapertura via API: 200, scheda «Inviata» in corso',
  );
  expect(
    (await countKind('application_reopened')) === 1,
    'timeline: un evento application_reopened',
  );
  const reopened = (await timeline()).find((e) => e.kind === 'application_reopened');
  expect(
    reopened.entity?.type === 'card' &&
      reopened.entity.id === 'k2' &&
      reopened.data.toStatus === 'applied' &&
      reopened.data.fromStatus === 'rejected',
    'evento con riferimenti corretti (scheda k2, da Rifiutata a Inviata)',
  );
  const r2 = await api('POST', '/cards/k2/pipeline', reopen);
  expect(
    r2.status === 200 &&
      r2.body.replayed === true &&
      (await countKind('application_reopened')) === 1,
    'retry della stessa operazione: replay, ancora UN solo evento',
  );
  const clash = await api('POST', '/cards/k2/pipeline', { ...reopen, to: 'screening' });
  expect(clash.status === 409, 'stesso ID con payload diverso: 409');
  expect(
    (
      await api('POST', '/cards/k2/pipeline', {
        id: 'close-op-00000000000001',
        to: 'withdrawn',
        kind: 'close',
      })
    ).status === 200,
    'nuova chiusura',
  );
  expect(
    (
      await api('POST', '/cards/k2/pipeline', {
        id: 'reopen-op-0000000002',
        to: 'screening',
        kind: 'reopen',
      })
    ).status === 200,
    'nuova riapertura con un nuovo ID',
  );
  expect(
    (await countKind('application_reopened')) === 2,
    'una nuova chiusura/riapertura produce un nuovo evento (2 in totale)',
  );
  const legacyClosed = await api('POST', '/cards/k6/pipeline', {
    id: 'legacy-op-00000000001',
    to: 'applied',
    kind: 'advance',
  });
  expect(
    legacyClosed.status === 409,
    'stato legacy «Chiusa» senza esito: la transizione ordinaria è rifiutata (serve la correzione)',
  );
  const noteRes = await api('POST', '/cards/k1/notes', {
    id: 'note-op-000000000001',
    body: 'Dopo l’upgrade',
  });
  expect(noteRes.status === 201, 'una nota si crea su una scheda preesistente');
  const iv = await api('POST', '/cards/k1/interviews', {
    id: 'iv-op-0000000000001',
    title: 'Terzo',
  });
  expect(
    iv.status === 201 && iv.body.interview.sequence === 4,
    'creazione colloquio idempotente su dati preesistenti (sequenza 4 dopo i 3 round esistenti)',
  );
  const other = await fetch(`http://localhost:${port}/api/v1/cards/k2/timeline?workspaceId=w2`);
  expect(other.status === 404, 'isolamento: la timeline di una scheda di w1 chiesta con w2 è 404');

  console.log(`\nAggiornamento M2.5 → ${target}: OK`);
} finally {
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      /* già terminato */
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
