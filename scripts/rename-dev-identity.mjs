// Procedura OFFLINE e locale, mai invocata automaticamente all'avvio o durante l'installazione.
import { DatabaseSync } from 'node:sqlite';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function renameDevIdentity(db, { from, to, apply = false }) {
  if (!from || !to || from === to || !from.endsWith('.local') || !to.endsWith('.local'))
    throw new Error('Sono ammesse solo due identità locali diverse');
  db.exec('PRAGMA foreign_keys = ON; BEGIN IMMEDIATE');
  try {
    const source = db.prepare('SELECT id FROM users WHERE email = ?').get(from);
    if (!source) throw new Error('Identità sorgente assente');
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(to))
      throw new Error('Identità destinazione già presente: nessuna fusione automatica');
    const changed = db
      .prepare('UPDATE users SET email = ? WHERE id = ? AND email = ?')
      .run(to, source.id, from);
    if (changed.changes !== 1) throw new Error('Aggiornamento non univoco');
    if (db.prepare('PRAGMA foreign_key_check').all().length)
      throw new Error('Violazione di chiavi esterne');
    db.exec(apply ? 'COMMIT' : 'ROLLBACK');
    return { userId: source.id, applied: apply };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const [file, from, to, mode] = process.argv.slice(2);
  if (!file || !from || !to || (mode !== undefined && mode !== '--apply')) {
    console.error(
      'Uso: node scripts/rename-dev-identity.mjs <database.sqlite> <email-origine.local> <email-destinazione.local> [--apply]',
    );
    process.exitCode = 1;
  } else {
    const db = new DatabaseSync(realpathSync(file));
    try {
      console.log(renameDevIdentity(db, { from, to, apply: mode === '--apply' }));
    } finally {
      db.close();
    }
  }
}
