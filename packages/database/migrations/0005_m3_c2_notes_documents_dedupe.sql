-- 0005 — M3-C2: note, riferimenti documentali, idempotenza degli eventi e riapertura.
--
-- PARTE 1 (additiva): CREATE TABLE card_notes e card_documents (chiave composita (scheda, workspace),
-- lapide per l'eliminazione, fingerprint della richiesta di creazione) + colonna interviews.request_fingerprint
-- (NULL per i round preesistenti: nessun backfill).
--
-- PARTE 2 (ricostruzione CONTROLLATA di `activity_events`): servono il tipo `application_reopened`
-- nel CHECK e tre colonne nuove (dedupe_key, operation_id, request_fingerprint), quindi la tabella va
-- ricostruita (il CHECK non si modifica con ALTER). Come in 0004, ma con più garanzie:
--   * CONSERVAZIONE INTEGRALE: INSERT … SELECT di tutte le colonne preesistenti; gli eventi esistenti
--     ricevono dedupe_key/operation_id/request_fingerprint = NULL;
--   * una GUARDIA interrompe la migrazione PRIMA di qualunque DROP se il numero di righe copiate non
--     coincide o se anche una sola riga differisce (id, riferimenti, tipo, metadati, timestamp);
--   * nessuna tabella ha chiavi esterne VERSO activity_events (è una foglia): il DROP non innesca
--     cascate né richiede PRAGMA foreign_keys (non affidabile su D1; lo SQL di drizzle-kit è stato
--     riscritto a mano per questo);
--   * indici, FK (con le stesse azioni ON DELETE/ON UPDATE) e i due TRIGGER di isolamento tra workspace
--     (insert da 0001, update nella versione di 0002) vengono RICREATI identici;
--   * il CHECK è scritto senza qualificatore di tabella (non dipende dal nome temporaneo).
-- Le migrazioni 0000–0004 non sono modificate. Lo snapshot meta/0005_snapshot.json è quello generato
-- da drizzle dallo schema TypeScript.

CREATE TABLE `card_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`card_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'other' NOT NULL,
	`url` text,
	`note` text,
	`request_fingerprint` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`,`workspace_id`) REFERENCES `cards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "card_documents_kind_valid" CHECK("card_documents"."kind" in ('cv', 'cover_letter', 'job_posting', 'portfolio', 'other')),
	CONSTRAINT "card_documents_title_valid" CHECK("card_documents"."deleted_at" is not null or length("card_documents"."title") between 1 and 200),
	CONSTRAINT "card_documents_url_valid" CHECK("card_documents"."url" is null or "card_documents"."url" like 'http://%' or "card_documents"."url" like 'https://%'),
	CONSTRAINT "card_documents_fingerprint_valid" CHECK(("card_documents"."deleted_at" is null and coalesce(length("card_documents"."request_fingerprint"), 0) = 64) or ("card_documents"."deleted_at" is not null and "card_documents"."request_fingerprint" is null)),
	CONSTRAINT "card_documents_tombstone_scrubbed" CHECK("card_documents"."deleted_at" is null or ("card_documents"."title" = '' and "card_documents"."url" is null and "card_documents"."note" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_documents_id_workspace_unique` ON `card_documents` (`id`,`workspace_id`);--> statement-breakpoint
CREATE INDEX `card_documents_card_created_idx` ON `card_documents` (`card_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `card_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`card_id` text NOT NULL,
	`body` text NOT NULL,
	`request_fingerprint` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`,`workspace_id`) REFERENCES `cards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "card_notes_body_valid" CHECK("card_notes"."deleted_at" is not null or length("card_notes"."body") between 1 and 10000),
	CONSTRAINT "card_notes_fingerprint_valid" CHECK(("card_notes"."deleted_at" is null and coalesce(length("card_notes"."request_fingerprint"), 0) = 64) or ("card_notes"."deleted_at" is not null and "card_notes"."request_fingerprint" is null)),
	CONSTRAINT "card_notes_tombstone_scrubbed" CHECK("card_notes"."deleted_at" is null or "card_notes"."body" = '')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_notes_id_workspace_unique` ON `card_notes` (`id`,`workspace_id`);--> statement-breakpoint
CREATE INDEX `card_notes_card_created_idx` ON `card_notes` (`card_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `__new_activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`board_id` text,
	`card_id` text,
	`actor_user_id` text,
	`type` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`occurred_at` integer NOT NULL,
	`dedupe_key` text,
	`operation_id` text,
	`request_fingerprint` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "activity_events_type_valid" CHECK(`type` in ('card_created', 'card_moved', 'card_archived', 'card_restored', 'stage_changed', 'priority_changed', 'application_submitted', 'contact_logged', 'task_added', 'task_completed', 'application_closed', 'interview_created', 'interview_next_round_created', 'interview_rescheduled', 'interview_completed', 'interview_cancelled', 'interview_feedback_recorded', 'application_reopened')),
	CONSTRAINT "activity_events_operation_consistent" CHECK((`operation_id` is null) = (`request_fingerprint` is null)),
	CONSTRAINT "activity_events_dedupe_needs_operation" CHECK(`dedupe_key` is null or `operation_id` is not null)
);--> statement-breakpoint
INSERT INTO `__new_activity_events`(`id`, `workspace_id`, `board_id`, `card_id`, `actor_user_id`, `type`, `metadata`, `occurred_at`) SELECT `id`, `workspace_id`, `board_id`, `card_id`, `actor_user_id`, `type`, `metadata`, `occurred_at` FROM `activity_events`;--> statement-breakpoint
CREATE TABLE `_m3c2_guard` (`copied_identical` integer NOT NULL CHECK (`copied_identical` = 1));--> statement-breakpoint
INSERT INTO `_m3c2_guard` VALUES ((
  SELECT (SELECT count(*) FROM `__new_activity_events`) = (SELECT count(*) FROM `activity_events`)
     AND NOT EXISTS (
       SELECT 1 FROM `activity_events` o WHERE NOT EXISTS (
         SELECT 1 FROM `__new_activity_events` n
         WHERE n.`id` = o.`id` AND n.`workspace_id` = o.`workspace_id` AND n.`board_id` IS o.`board_id`
           AND n.`card_id` IS o.`card_id` AND n.`actor_user_id` IS o.`actor_user_id` AND n.`type` = o.`type`
           AND n.`metadata` = o.`metadata` AND n.`occurred_at` = o.`occurred_at`
           AND n.`dedupe_key` IS NULL AND n.`operation_id` IS NULL AND n.`request_fingerprint` IS NULL))
));--> statement-breakpoint
DROP TABLE `_m3c2_guard`;--> statement-breakpoint
DROP TABLE `activity_events`;--> statement-breakpoint
ALTER TABLE `__new_activity_events` RENAME TO `activity_events`;--> statement-breakpoint
CREATE INDEX `activity_events_workspace_time_idx` ON `activity_events` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `activity_events_card_time_idx` ON `activity_events` (`card_id`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `activity_events_dedupe_unique` ON `activity_events` (`workspace_id`,`dedupe_key`) WHERE "activity_events"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX `activity_events_operation_idx` ON `activity_events` (`workspace_id`,`operation_id`) WHERE "activity_events"."operation_id" is not null;--> statement-breakpoint
CREATE TRIGGER `activity_events_tenant_insert` BEFORE INSERT ON `activity_events`
WHEN (NEW.card_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cards` WHERE `id` = NEW.card_id AND `workspace_id` = NEW.workspace_id))
  OR (NEW.board_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `boards` WHERE `id` = NEW.board_id AND `workspace_id` = NEW.workspace_id))
  OR (NEW.actor_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `workspace_members` WHERE `workspace_id` = NEW.workspace_id AND `user_id` = NEW.actor_user_id))
BEGIN
  SELECT RAISE(ABORT, 'activity_events: riferimento a una risorsa di un altro workspace');
END;--> statement-breakpoint
CREATE TRIGGER `activity_events_tenant_update` BEFORE UPDATE OF `workspace_id`, `board_id`, `card_id`, `actor_user_id` ON `activity_events`
WHEN (NEW.card_id IS NOT NULL AND (NEW.card_id IS NOT OLD.card_id OR NEW.workspace_id IS NOT OLD.workspace_id)
      AND NOT EXISTS (SELECT 1 FROM `cards` WHERE `id` = NEW.card_id AND `workspace_id` = NEW.workspace_id))
  OR (NEW.board_id IS NOT NULL AND (NEW.board_id IS NOT OLD.board_id OR NEW.workspace_id IS NOT OLD.workspace_id)
      AND NOT EXISTS (SELECT 1 FROM `boards` WHERE `id` = NEW.board_id AND `workspace_id` = NEW.workspace_id))
  OR (NEW.actor_user_id IS NOT NULL AND (NEW.actor_user_id IS NOT OLD.actor_user_id OR NEW.workspace_id IS NOT OLD.workspace_id)
      AND NOT EXISTS (SELECT 1 FROM `workspace_members` WHERE `workspace_id` = NEW.workspace_id AND `user_id` = NEW.actor_user_id))
BEGIN
  SELECT RAISE(ABORT, 'activity_events: riferimento a una risorsa di un altro workspace');
END;--> statement-breakpoint
ALTER TABLE `interviews` ADD `request_fingerprint` text;
