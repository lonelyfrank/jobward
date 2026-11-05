-- 0003 — M2: natura dell'importo (lordo/netto) e indici di ricerca. SOLO modifiche additive.
--
-- `drizzle-kit generate` produce per la nuova colonna la ricostruzione completa di
-- `application_details` (CREATE __new_… / INSERT … SELECT / DROP / RENAME con PRAGMA foreign_keys),
-- che su D1 è pericolosa: PRAGMA foreign_keys non è affidabile e il DROP elimina i dati dei
-- dettagli già inseriti in M1 (azienda e URL). Qui la modifica è invece additiva:
--   * ALTER TABLE … ADD COLUMN con CHECK inline: le righe esistenti ricevono NULL = "non specificato"
--     e il vincolo (NULL ammesso) non può essere violato. Nessuna riga viene copiata né rimossa.
--   * Indici nuovi: `cards(workspace_id, updated_at)` per l'ordinamento predefinito di ricerca e tabella;
--     nome univoco dei campi personalizzati nella bacheca (la tabella non è scritta da nessun endpoint di M1).
-- Lo snapshot in meta/0003_snapshot.json è quello generato dallo schema TypeScript, che resta la fonte.

ALTER TABLE `application_details` ADD `salary_basis` text CONSTRAINT "application_details_basis_valid" CHECK ("salary_basis" is null or "salary_basis" in ('gross', 'net'));--> statement-breakpoint
CREATE INDEX `cards_workspace_updated_idx` ON `cards` (`workspace_id`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `custom_field_definitions_board_name_unique` ON `custom_field_definitions` (`board_id`,lower("name"));
