-- 0006 — M3 Tasks: attività, follow-up e scadenze come DATE di calendario. SOLO ADDITIVA.
--
-- La tabella `tasks` esiste dalla 0000 (ricostruita in 0001) ma non ha mai avuto un percorso di
-- scrittura. Questa migrazione NON la ricostruisce (nessun DROP TABLE, nessun PRAGMA, nessun trigger):
--   * `ALTER TABLE … ADD COLUMN` con CHECK di colonna. In SQLite i CHECK di colonna possono referenziare
--     le altre colonne della riga, sono applicati a INSERT e UPDATE e sono VALIDATI sulle righe già
--     presenti: una riga legacy che li violasse interromperebbe la migrazione (nessuna correzione
--     silenziosa). Nel modello TypeScript sono dichiarati come `check()` di tabella con gli stessi nomi.
--   * `due_at` (istante) resta come colonna LEGACY non più letta né scritta; le righe preesistenti
--     sono conservate identiche (`kind = 'general'`, `due_on`/`cancelled_at`/fingerprint NULL).
--   * Si sostituisce l'indice basato su `due_at` con indici parziali per l'ordinamento operativo.
-- Le migrazioni 0000–0005 non sono modificate. Nessuna scrittura in `activity_events` (D-06).
--   * `due_on`: `date(x) IS x` e non `date(x) = x`: per un mese impossibile (2026-13-01) `date()` dà NULL e
--     un CHECK che valuta NULL PASSA; `IS` è null-safe e rifiuta anche quel caso (trovato dalla prova di upgrade).
-- Lo snapshot meta/0006_snapshot.json è quello generato da drizzle dallo schema TypeScript.

ALTER TABLE `tasks` ADD `cancelled_at` integer CONSTRAINT "tasks_not_done_and_cancelled" CHECK(`completed_at` is null or `cancelled_at` is null);--> statement-breakpoint
ALTER TABLE `tasks` ADD `kind` text DEFAULT 'general' NOT NULL CONSTRAINT "tasks_kind_valid" CHECK(`kind` in ('general', 'follow_up', 'preparation')) CONSTRAINT "tasks_title_valid" CHECK(length(`title`) between 1 and 200) CONSTRAINT "tasks_description_valid" CHECK(`description` is null or length(`description`) <= 2000);--> statement-breakpoint
ALTER TABLE `tasks` ADD `due_on` text CONSTRAINT "tasks_due_on_valid" CHECK(`due_on` is null or (`due_on` glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' and date(`due_on`) is `due_on`));--> statement-breakpoint
ALTER TABLE `tasks` ADD `request_fingerprint` text CONSTRAINT "tasks_fingerprint_valid" CHECK(`request_fingerprint` is null or length(`request_fingerprint`) = 64);--> statement-breakpoint
DROP INDEX `tasks_workspace_open_due_idx`;--> statement-breakpoint
CREATE INDEX `tasks_open_due_idx` ON `tasks` (`workspace_id`,`due_on`,`id`) WHERE `completed_at` is null and `cancelled_at` is null;--> statement-breakpoint
CREATE INDEX `tasks_done_idx` ON `tasks` (`workspace_id`,`completed_at`,`id`) WHERE `completed_at` is not null;
