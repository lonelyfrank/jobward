-- 0004 — M2.5: colloqui (tabella `interviews`) e nuovi tipi di evento di cronologia.
--
-- PARTE 1 (additiva): CREATE TABLE interviews con chiave composita (scheda, workspace), vincoli di
-- coerenza (l'esito solo se completato, una data se programmato, completed_at coerente) e indici.
--
-- PARTE 2 (ricostruzione CONTROLLATA di `activity_events`): il vincolo CHECK sull'elenco dei tipi di
-- evento non si può modificare con ALTER TABLE, quindi la tabella va ricostruita per ammettere i
-- nuovi tipi. A differenza di 0001 contiene dati (la cronologia di M1/M2), perciò:
--   * si copia TUTTO (INSERT … SELECT) e una GUARDIA interrompe la migrazione, prima di qualunque
--     DROP, se il numero di righe copiate non coincide (CHECK violato → transazione annullata);
--   * nessuna tabella ha chiavi esterne VERSO activity_events (è una foglia): il DROP non
--     innesca cascate né richiede PRAGMA foreign_keys (non affidabile su D1);
--   * i TRIGGER di isolamento tra workspace spariscono col DROP e vengono RICREATI identici
--     (insert da 0001, update nella versione corretta di 0002) subito dopo;
--   * il CHECK è scritto senza qualificatore di tabella, così non dipende dal nome temporaneo.
-- Lo snapshot meta/0004_snapshot.json è quello generato da drizzle dallo schema TypeScript.

CREATE TABLE `interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`card_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`status` text DEFAULT 'to_schedule' NOT NULL,
	`scheduled_at` integer,
	`timezone` text,
	`duration_minutes` integer,
	`modality` text,
	`location` text,
	`meeting_url` text,
	`interviewers` text DEFAULT '[]' NOT NULL,
	`preparation_notes` text,
	`feedback_notes` text,
	`result` text,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`,`workspace_id`) REFERENCES `cards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "interviews_sequence_positive" CHECK("interviews"."sequence" >= 1),
	CONSTRAINT "interviews_type_valid" CHECK("interviews"."type" in ('screening', 'technical', 'behavioral', 'panel', 'final', 'other')),
	CONSTRAINT "interviews_status_valid" CHECK("interviews"."status" in ('to_schedule', 'scheduled', 'completed', 'cancelled')),
	CONSTRAINT "interviews_modality_valid" CHECK("interviews"."modality" is null or "interviews"."modality" in ('video', 'phone', 'onsite')),
	CONSTRAINT "interviews_result_valid" CHECK("interviews"."result" is null or "interviews"."result" in ('positive', 'neutral', 'negative')),
	CONSTRAINT "interviews_duration_valid" CHECK("interviews"."duration_minutes" is null or "interviews"."duration_minutes" between 1 and 1440),
	CONSTRAINT "interviews_result_needs_completed" CHECK("interviews"."result" is null or "interviews"."status" = 'completed'),
	CONSTRAINT "interviews_scheduled_has_date" CHECK("interviews"."status" <> 'scheduled' or "interviews"."scheduled_at" is not null),
	CONSTRAINT "interviews_completed_at_matches" CHECK(("interviews"."status" = 'completed') = ("interviews"."completed_at" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interviews_card_sequence_unique` ON `interviews` (`card_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `interviews_id_workspace_unique` ON `interviews` (`id`,`workspace_id`);--> statement-breakpoint
CREATE INDEX `interviews_workspace_status_idx` ON `interviews` (`workspace_id`,`status`,`scheduled_at`);--> statement-breakpoint

CREATE TABLE `__new_activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`board_id` text,
	`card_id` text,
	`actor_user_id` text,
	`type` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "activity_events_type_valid" CHECK(`type` in ('card_created', 'card_moved', 'card_archived', 'card_restored', 'stage_changed', 'priority_changed', 'application_submitted', 'contact_logged', 'task_added', 'task_completed', 'application_closed', 'interview_created', 'interview_next_round_created', 'interview_rescheduled', 'interview_completed', 'interview_cancelled', 'interview_feedback_recorded'))
);--> statement-breakpoint
INSERT INTO `__new_activity_events`(`id`, `workspace_id`, `board_id`, `card_id`, `actor_user_id`, `type`, `metadata`, `occurred_at`) SELECT `id`, `workspace_id`, `board_id`, `card_id`, `actor_user_id`, `type`, `metadata`, `occurred_at` FROM `activity_events`;--> statement-breakpoint
CREATE TABLE `_m25_guard` (`copied_matches` integer NOT NULL CHECK (`copied_matches` = 1));--> statement-breakpoint
INSERT INTO `_m25_guard` VALUES ((SELECT (SELECT count(*) FROM `__new_activity_events`) = (SELECT count(*) FROM `activity_events`)));--> statement-breakpoint
DROP TABLE `_m25_guard`;--> statement-breakpoint
DROP TABLE `activity_events`;--> statement-breakpoint
ALTER TABLE `__new_activity_events` RENAME TO `activity_events`;--> statement-breakpoint
CREATE INDEX `activity_events_workspace_time_idx` ON `activity_events` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `activity_events_card_time_idx` ON `activity_events` (`card_id`,`occurred_at`);--> statement-breakpoint
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
END;
