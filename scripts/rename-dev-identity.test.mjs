import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { renameDevIdentity } from './rename-dev-identity.mjs';

const from = 'dev@old.local';
const to = 'dev@jobward.local';
const fixture = () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE,created_at INTEGER);
    CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT REFERENCES users(id));
    INSERT INTO users VALUES ('owner','${from}',123);
    INSERT INTO workspace_members VALUES ('workspace','owner');`);
  return db;
};
test('schema reale M2.5: conserva tutte le righe e i riferimenti esistenti', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const dir = new URL('../packages/database/migrations/', import.meta.url);
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort())
      db.exec(readFileSync(new URL(file, dir), 'utf8'));
    db.exec(`INSERT INTO users (id,email,created_at,updated_at) VALUES ('owner','${from}',123,123);
      INSERT INTO workspaces (id,name,timezone,created_at,updated_at) VALUES ('workspace','Local','UTC',123,123);
      INSERT INTO workspace_members (workspace_id,user_id,role,created_at) VALUES ('workspace','owner','owner',123);
      INSERT INTO activity_events (id,workspace_id,actor_user_id,type,occurred_at) VALUES ('event','workspace','owner','contact_logged',123);`);
    const before = db.prepare('SELECT * FROM activity_events').all();
    renameDevIdentity(db, { from, to, apply: true });
    assert.deepEqual(db.prepare('SELECT * FROM activity_events').all(), before);
    assert.equal(db.prepare('SELECT user_id FROM workspace_members').get().user_id, 'owner');
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 1);
    assert.equal(db.prepare('SELECT email FROM users').get().email, to);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});
test('dry-run: mantiene email, ID e membership', () => {
  const db = fixture();
  try {
    assert.deepEqual(renameDevIdentity(db, { from, to }), { userId: 'owner', applied: false });
    assert.equal(db.prepare('SELECT email FROM users').get().email, from);
    assert.equal(db.prepare('SELECT user_id FROM workspace_members').get().user_id, 'owner');
  } finally {
    db.close();
  }
});
test('apply temporaneo: cambia soltanto email e preserva riferimenti e timestamp', () => {
  const db = fixture();
  try {
    assert.deepEqual(renameDevIdentity(db, { from, to, apply: true }), {
      userId: 'owner',
      applied: true,
    });
    assert.deepEqual(
      { ...db.prepare('SELECT * FROM users').get() },
      { id: 'owner', email: to, created_at: 123 },
    );
    assert.equal(db.prepare('SELECT user_id FROM workspace_members').get().user_id, 'owner');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});
test('collisione: rollback senza fondere utenti', () => {
  const db = fixture();
  try {
    db.prepare('INSERT INTO users VALUES (?,?,123)').run('other', to);
    assert.throws(() => renameDevIdentity(db, { from, to, apply: true }), /già presente/);
    assert.equal(db.prepare('SELECT email FROM users WHERE id=?').get('owner').email, from);
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 2);
  } finally {
    db.close();
  }
});
test('sorgente assente e destinazione non locale: nessuna modifica', () => {
  const db = fixture();
  try {
    assert.throws(
      () => renameDevIdentity(db, { from: 'missing@old.local', to, apply: true }),
      /assente/,
    );
    assert.throws(
      () => renameDevIdentity(db, { from, to: 'remote@example.com', apply: true }),
      /locali/,
    );
    assert.equal(db.prepare('SELECT email FROM users').get().email, from);
  } finally {
    db.close();
  }
});
