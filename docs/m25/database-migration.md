# M2.5 — Migrazione `0004`

**File:** `packages/database/migrations/0004_m25_interviews.sql` (+ snapshot generato da drizzle). Base: schema fino a `0003` (M2).

## Parte 1 — additiva: tabella `interviews`

`CREATE TABLE` con: chiave primaria; `FOREIGN KEY (card_id, workspace_id) → cards(id, workspace_id) ON DELETE CASCADE` (ADR-0007); indice univoco `(card_id, sequence)`; indice univoco `(id, workspace_id)`; indice `(workspace_id, status, scheduled_at)`; CHECK:
`sequence ≥ 1`, vocabolari di tipo/stato/modalità/esito, `durata 1–1440`, **`result` solo se `completed`**, **`scheduled` ⇒ `scheduled_at` presente**, **`completed` ⇔ `completed_at` presente**.
Eliminare una scheda elimina i suoi round (cascata); **archiviarla non li tocca**.

## Parte 2 — ricostruzione controllata di `activity_events`

Il CHECK sui tipi di evento non si modifica con `ALTER TABLE`: per ammettere i sei nuovi tipi la tabella è ricostruita. A differenza di `0001`, **contiene dati** (la cronologia), quindi:

1. `CREATE TABLE __new_activity_events` (stesse colonne e FK, CHECK senza qualificatore di tabella);
2. `INSERT … SELECT` di **tutte** le righe;
3. **guardia**: una tabella temporanea con `CHECK (copied_matches = 1)` riceve il confronto dei conteggi; se differiscono, la migrazione si interrompe (transazione annullata) **prima** di qualsiasi `DROP`;
4. `DROP TABLE activity_events` — nessuna tabella ha chiavi esterne _verso_ `activity_events` (è una foglia), quindi nessuna cascata e **nessun `PRAGMA foreign_keys`** (non affidabile su D1);
5. `RENAME`, ricreazione dei 2 indici;
6. **ricreazione dei 2 trigger di isolamento** (`insert` da `0001`, `update` nella versione corretta di `0002`), che il `DROP` aveva eliminato.

### Perché non quella generata

`drizzle-kit generate` produce la ricostruzione con `PRAGMA foreign_keys=OFF/ON` **senza** ricreare i trigger: avrebbe lasciato `activity_events` senza la protezione tra workspace. È lo stesso difetto di classe di M2-04. La migrazione è scritta a mano; lo snapshot resta quello generato (`pnpm db:check` verifica che coincida con lo schema TypeScript).

## Prova: `pnpm db:upgrade-test`

Parte da un database M1 (`0000–0002`) popolato — 601 schede (60 archiviate), dettagli, etichetta, **4 eventi di cronologia** di tipi diversi in due workspace — applica `0003` e `0004` e verifica:

- schede, archiviate e dettagli identici; **cronologia identica riga per riga** (4 eventi);
- trigger e indici di `activity_events` ricreati; l'inserimento di un evento verso risorse di un altro workspace è **ancora rifiutato**;
- nuovi tipi di evento ammessi, tipo sconosciuto rifiutato;
- colloqui: `sequence` duplicata, scheda di un altro workspace, «programmato» senza data, esito su un colloquio non completato, «completato» senza data → tutti rifiutati dal database; colloquio valido accettato; eliminando la scheda i colloqui seguono.
  Il test gira in `pnpm check` e in CI.

## Reversibilità e deploy

La migrazione è in avanti. Per tornare indietro basta non usare i colloqui: `interviews` è isolata e può essere eliminata (`DROP TABLE`) senza toccare altro; i nuovi tipi di evento resterebbero ammessi. **Non è stato eseguito nessun `wrangler d1 migrations apply` su D1 remoto.**
