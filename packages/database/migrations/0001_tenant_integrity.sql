-- 0001 — Integrità tra workspace garantita dal database (M0.H)
--
-- PROBLEMA (verificato): con lo schema di 0000 il database accettava righe che collegavano
-- risorse di workspace DIVERSI (scheda su bacheca altrui, etichetta altrui su una scheda, ecc.).
-- Nessun endpoint M0 scrive in quelle tabelle, ma M1 le userebbe: l'invariante deve valere
-- indipendentemente dal service layer.
--
-- SOLUZIONE: chiavi esterne COMPOSITE che includono workspace_id (e, per le schede, anche la
-- bacheca), più TRIGGER per i casi che le FK non possono esprimere (riferimenti facoltativi con
-- SET NULL; coerenza scheda↔campo personalizzato). cards.column_id passa da RESTRICT a NO ACTION.
--
-- SICUREZZA DEI DATI: SQLite non permette ALTER ... ADD FOREIGN KEY, quindi le 7 tabelle
-- interessate vengono ricreate. Nessun endpoint di M0 inserisce righe in queste tabelle, perciò
-- in ogni database prodotto dal codice di M0 sono vuote e non c'è nulla da copiare. Per non
-- affidarsi a questa ipotesi, la GUARDIA qui sotto interrompe la migrazione (CHECK violato,
-- transazione annullata) PRIMA di qualunque operazione distruttiva se una di esse contiene righe.
-- Non si usa PRAGMA foreign_keys: D1 non lo supporta in modo affidabile.

CREATE TABLE `_m0h_guard` (`rows_in_rebuilt_tables` integer NOT NULL CHECK (`rows_in_rebuilt_tables` = 0));--> statement-breakpoint
INSERT INTO `_m0h_guard` VALUES ((SELECT count(*) FROM `card_labels`) + (SELECT count(*) FROM `custom_field_values`) + (SELECT count(*) FROM `application_details`) + (SELECT count(*) FROM `tasks`) + (SELECT count(*) FROM `cards`) + (SELECT count(*) FROM `custom_field_definitions`) + (SELECT count(*) FROM `board_columns`));--> statement-breakpoint
DROP TABLE `_m0h_guard`;--> statement-breakpoint

-- Si eliminano prima i figli, poi i genitori (tabelle vuote: nessuna cascade da eseguire).
DROP TABLE `card_labels`;--> statement-breakpoint
DROP TABLE `custom_field_values`;--> statement-breakpoint
DROP TABLE `application_details`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
DROP TABLE `cards`;--> statement-breakpoint
DROP TABLE `custom_field_definitions`;--> statement-breakpoint
DROP TABLE `board_columns`;--> statement-breakpoint

-- Bersagli delle chiavi composite sulle tabelle che NON vengono ricreate.
CREATE UNIQUE INDEX `boards_id_workspace_unique` ON `boards` (`id`,`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `labels_id_workspace_unique` ON `labels` (`id`,`workspace_id`);--> statement-breakpoint

-- Tabelle ricreate (genitori prima dei figli).
CREATE TABLE `board_columns` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`board_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`position` integer NOT NULL,
	`category` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`,`workspace_id`) REFERENCES `boards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "board_columns_category_valid" CHECK("board_columns"."category" is null or "board_columns"."category" in ('saved', 'preparing', 'applied', 'in_contact', 'interviewing', 'offer', 'closed'))
);--> statement-breakpoint
CREATE TABLE `custom_field_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`board_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`,`workspace_id`) REFERENCES `boards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "custom_field_definitions_type_valid" CHECK("custom_field_definitions"."type" in ('text', 'long_text', 'number', 'date', 'boolean', 'single_select', 'multi_select', 'url'))
);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`board_id` text NOT NULL,
	`column_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`position` integer NOT NULL,
	`priority` text DEFAULT 'none' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`,`workspace_id`) REFERENCES `boards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`column_id`,`board_id`,`workspace_id`) REFERENCES `board_columns`(`id`,`board_id`,`workspace_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cards_priority_valid" CHECK("cards"."priority" in ('none', 'low', 'medium', 'high', 'urgent'))
);--> statement-breakpoint
CREATE TABLE `application_details` (
	`card_id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`company` text,
	`position` text,
	`location` text,
	`work_mode` text,
	`contract_type` text,
	`salary_min` integer,
	`salary_max` integer,
	`currency` text,
	`salary_period` text,
	`source` text,
	`source_url` text,
	`published_on` text,
	`applied_on` text,
	`stage` text,
	`outcome` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`,`workspace_id`) REFERENCES `cards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "application_details_work_mode_valid" CHECK("application_details"."work_mode" is null or "application_details"."work_mode" in ('onsite', 'hybrid', 'remote')),
	CONSTRAINT "application_details_contract_valid" CHECK("application_details"."contract_type" is null or "application_details"."contract_type" in ('permanent', 'fixed_term', 'part_time', 'freelance', 'internship', 'apprenticeship', 'temporary', 'other')),
	CONSTRAINT "application_details_period_valid" CHECK("application_details"."salary_period" is null or "application_details"."salary_period" in ('hour', 'day', 'week', 'month', 'year')),
	CONSTRAINT "application_details_stage_valid" CHECK("application_details"."stage" is null or "application_details"."stage" in ('saved', 'preparing', 'applied', 'in_contact', 'interviewing', 'offer', 'closed')),
	CONSTRAINT "application_details_outcome_valid" CHECK("application_details"."outcome" is null or "application_details"."outcome" in ('pending', 'accepted', 'rejected', 'withdrawn', 'no_response', 'offer_declined')),
	CONSTRAINT "application_details_salary_range" CHECK("application_details"."salary_min" is null or "application_details"."salary_max" is null or "application_details"."salary_min" <= "application_details"."salary_max")
);--> statement-breakpoint
CREATE TABLE `custom_field_values` (
	`card_id` text NOT NULL,
	`field_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`card_id`, `field_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`,`workspace_id`) REFERENCES `cards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`,`workspace_id`) REFERENCES `custom_field_definitions`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE TABLE `card_labels` (
	`card_id` text NOT NULL,
	`label_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	PRIMARY KEY(`card_id`, `label_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`,`workspace_id`) REFERENCES `cards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`,`workspace_id`) REFERENCES `labels`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`card_id` text,
	`title` text NOT NULL,
	`description` text,
	`due_at` integer,
	`completed_at` integer,
	`priority` text DEFAULT 'none' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`,`workspace_id`) REFERENCES `cards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tasks_priority_valid" CHECK("tasks"."priority" in ('none', 'low', 'medium', 'high', 'urgent'))
);--> statement-breakpoint

CREATE INDEX `application_details_workspace_stage_idx` ON `application_details` (`workspace_id`,`stage`);--> statement-breakpoint
CREATE INDEX `board_columns_board_position_idx` ON `board_columns` (`board_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `board_columns_id_board_workspace_unique` ON `board_columns` (`id`,`board_id`,`workspace_id`);--> statement-breakpoint
CREATE INDEX `card_labels_label_idx` ON `card_labels` (`label_id`);--> statement-breakpoint
CREATE INDEX `cards_column_position_idx` ON `cards` (`column_id`,`position`);--> statement-breakpoint
CREATE INDEX `cards_workspace_archived_idx` ON `cards` (`workspace_id`,`archived_at`);--> statement-breakpoint
CREATE INDEX `cards_board_idx` ON `cards` (`board_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cards_id_workspace_unique` ON `cards` (`id`,`workspace_id`);--> statement-breakpoint
CREATE INDEX `custom_field_definitions_board_idx` ON `custom_field_definitions` (`board_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `custom_field_definitions_id_workspace_unique` ON `custom_field_definitions` (`id`,`workspace_id`);--> statement-breakpoint
CREATE INDEX `custom_field_values_field_idx` ON `custom_field_values` (`field_id`);--> statement-breakpoint
CREATE INDEX `tasks_workspace_open_due_idx` ON `tasks` (`workspace_id`,`completed_at`,`due_at`);--> statement-breakpoint
CREATE INDEX `tasks_card_idx` ON `tasks` (`card_id`);--> statement-breakpoint

-- ---------------------------------------------------------------------------------------------
-- TRIGGER (non modellati da drizzle: vivono solo in questo file)
-- ---------------------------------------------------------------------------------------------

-- activity_events: scheda, bacheca e autore, se presenti, devono appartenere al workspace dell'evento.
-- (Una FK composita con SET NULL azzererebbe anche workspace_id, che è NOT NULL.)
CREATE TRIGGER `activity_events_tenant_insert` BEFORE INSERT ON `activity_events`
WHEN (NEW.card_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cards` WHERE `id` = NEW.card_id AND `workspace_id` = NEW.workspace_id))
  OR (NEW.board_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `boards` WHERE `id` = NEW.board_id AND `workspace_id` = NEW.workspace_id))
  OR (NEW.actor_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `workspace_members` WHERE `workspace_id` = NEW.workspace_id AND `user_id` = NEW.actor_user_id))
BEGIN
  SELECT RAISE(ABORT, 'activity_events: riferimento a una risorsa di un altro workspace');
END;--> statement-breakpoint
CREATE TRIGGER `activity_events_tenant_update` BEFORE UPDATE OF `workspace_id`, `board_id`, `card_id`, `actor_user_id` ON `activity_events`
WHEN (NEW.card_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cards` WHERE `id` = NEW.card_id AND `workspace_id` = NEW.workspace_id))
  OR (NEW.board_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `boards` WHERE `id` = NEW.board_id AND `workspace_id` = NEW.workspace_id))
  OR (NEW.actor_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `workspace_members` WHERE `workspace_id` = NEW.workspace_id AND `user_id` = NEW.actor_user_id))
BEGIN
  SELECT RAISE(ABORT, 'activity_events: riferimento a una risorsa di un altro workspace');
END;--> statement-breakpoint

-- custom_field_values: il campo deve appartenere alla stessa bacheca della scheda.
CREATE TRIGGER `custom_field_values_board_match_insert` BEFORE INSERT ON `custom_field_values`
WHEN (SELECT `board_id` FROM `cards` WHERE `id` = NEW.card_id) IS NOT (SELECT `board_id` FROM `custom_field_definitions` WHERE `id` = NEW.field_id)
BEGIN
  SELECT RAISE(ABORT, 'custom_field_values: il campo appartiene a un''altra bacheca');
END;--> statement-breakpoint
CREATE TRIGGER `custom_field_values_board_match_update` BEFORE UPDATE OF `card_id`, `field_id` ON `custom_field_values`
WHEN (SELECT `board_id` FROM `cards` WHERE `id` = NEW.card_id) IS NOT (SELECT `board_id` FROM `custom_field_definitions` WHERE `id` = NEW.field_id)
BEGIN
  SELECT RAISE(ABORT, 'custom_field_values: il campo appartiene a un''altra bacheca');
END;--> statement-breakpoint

-- cards: spostare una scheda su un'altra bacheca è vietato finché ha valori di campi della bacheca di origine.
CREATE TRIGGER `cards_board_change_custom_values` BEFORE UPDATE OF `board_id` ON `cards`
WHEN EXISTS (
  SELECT 1 FROM `custom_field_values` v JOIN `custom_field_definitions` d ON d.`id` = v.`field_id`
  WHERE v.`card_id` = NEW.`id` AND d.`board_id` <> NEW.`board_id`
)
BEGIN
  SELECT RAISE(ABORT, 'cards: rimuovere i valori dei campi personalizzati prima di cambiare bacheca');
END;
