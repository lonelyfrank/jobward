CREATE TABLE `activity_events` (
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
	`application_id` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "activity_events_type_valid" CHECK("activity_events"."type" in ('card_created', 'card_moved', 'card_archived', 'card_restored', 'stage_changed', 'priority_changed', 'application_submitted', 'contact_logged', 'task_added', 'task_completed', 'application_closed', 'interview_created', 'interview_next_round_created', 'interview_rescheduled', 'interview_completed', 'interview_cancelled', 'interview_feedback_recorded', 'application_reopened', 'application_created', 'card_placed', 'card_unplaced')),
	CONSTRAINT "activity_events_operation_consistent" CHECK(("activity_events"."operation_id" is null) = ("activity_events"."request_fingerprint" is null)),
	CONSTRAINT "activity_events_dedupe_needs_operation" CHECK("activity_events"."dedupe_key" is null or "activity_events"."operation_id" is not null)
);
--> statement-breakpoint
CREATE INDEX `activity_events_workspace_time_idx` ON `activity_events` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `activity_events_card_time_idx` ON `activity_events` (`card_id`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `activity_events_dedupe_unique` ON `activity_events` (`workspace_id`,`dedupe_key`) WHERE "activity_events"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX `activity_events_operation_idx` ON `activity_events` (`workspace_id`,`operation_id`) WHERE "activity_events"."operation_id" is not null;--> statement-breakpoint
CREATE INDEX `activity_events_application_time_idx` ON `activity_events` (`application_id`,`occurred_at`) WHERE "activity_events"."application_id" is not null;--> statement-breakpoint
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
	`salary_basis` text,
	`source` text,
	`source_url` text,
	`published_on` text,
	`seniority` text,
	`deadline_on` text,
	`requirements` text,
	`benefits` text,
	`interest` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`,`workspace_id`) REFERENCES `cards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "application_details_work_mode_valid" CHECK("application_details"."work_mode" is null or "application_details"."work_mode" in ('onsite', 'hybrid', 'remote')),
	CONSTRAINT "application_details_contract_valid" CHECK("application_details"."contract_type" is null or "application_details"."contract_type" in ('permanent', 'fixed_term', 'part_time', 'freelance', 'internship', 'apprenticeship', 'temporary', 'other')),
	CONSTRAINT "application_details_period_valid" CHECK("application_details"."salary_period" is null or "application_details"."salary_period" in ('hour', 'day', 'week', 'month', 'year')),
	CONSTRAINT "application_details_seniority_valid" CHECK("application_details"."seniority" is null or "application_details"."seniority" in ('intern', 'junior', 'mid', 'senior', 'lead', 'executive')),
	CONSTRAINT "application_details_interest_range" CHECK("application_details"."interest" is null or "application_details"."interest" between 1 and 5),
	CONSTRAINT "application_details_basis_valid" CHECK("application_details"."salary_basis" is null or "application_details"."salary_basis" in ('gross', 'net')),
	CONSTRAINT "application_details_salary_range" CHECK("application_details"."salary_min" is null or "application_details"."salary_max" is null or "application_details"."salary_min" <= "application_details"."salary_max")
);
--> statement-breakpoint
CREATE TABLE `application_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`application_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`company` text,
	`position` text,
	`location` text,
	`work_mode` text,
	`contract_type` text,
	`salary_min` integer,
	`salary_max` integer,
	`currency` text,
	`salary_period` text,
	`salary_basis` text,
	`listing_source` text,
	`listing_url` text,
	`published_on` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`,`workspace_id`) REFERENCES `applications`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "application_snapshots_version_positive" CHECK("application_snapshots"."version" >= 1),
	CONSTRAINT "application_snapshots_work_mode_valid" CHECK("application_snapshots"."work_mode" is null or "application_snapshots"."work_mode" in ('onsite', 'hybrid', 'remote')),
	CONSTRAINT "application_snapshots_contract_valid" CHECK("application_snapshots"."contract_type" is null or "application_snapshots"."contract_type" in ('permanent', 'fixed_term', 'part_time', 'freelance', 'internship', 'apprenticeship', 'temporary', 'other')),
	CONSTRAINT "application_snapshots_period_valid" CHECK("application_snapshots"."salary_period" is null or "application_snapshots"."salary_period" in ('hour', 'day', 'week', 'month', 'year')),
	CONSTRAINT "application_snapshots_basis_valid" CHECK("application_snapshots"."salary_basis" is null or "application_snapshots"."salary_basis" in ('gross', 'net')),
	CONSTRAINT "application_snapshots_salary_range" CHECK("application_snapshots"."salary_min" is null or "application_snapshots"."salary_max" is null or "application_snapshots"."salary_min" <= "application_snapshots"."salary_max")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_snapshots_version_unique` ON `application_snapshots` (`application_id`,`version`);--> statement-breakpoint
CREATE INDEX `application_snapshots_workspace_idx` ON `application_snapshots` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`stage` text,
	`outcome` text,
	`applied_on` text,
	`channel` text,
	`request_fingerprint` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`,`workspace_id`) REFERENCES `cards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "applications_sequence_positive" CHECK("applications"."sequence" >= 1),
	CONSTRAINT "applications_stage_valid" CHECK("applications"."stage" is null or "applications"."stage" in ('saved', 'preparing', 'applied', 'in_contact', 'interviewing', 'offer', 'closed')),
	CONSTRAINT "applications_outcome_valid" CHECK("applications"."outcome" is null or "applications"."outcome" in ('pending', 'accepted', 'rejected', 'withdrawn', 'no_response', 'offer_declined')),
	CONSTRAINT "applications_channel_length" CHECK("applications"."channel" is null or length("applications"."channel") <= 120),
	CONSTRAINT "applications_fingerprint_valid" CHECK("applications"."request_fingerprint" is null or length("applications"."request_fingerprint") = 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_id_workspace_unique` ON `applications` (`id`,`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_opportunity_sequence_unique` ON `applications` (`opportunity_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_fingerprint_unique` ON `applications` (`opportunity_id`,`request_fingerprint`) WHERE "applications"."request_fingerprint" is not null;--> statement-breakpoint
CREATE INDEX `applications_workspace_stage_idx` ON `applications` (`workspace_id`,`stage`);--> statement-breakpoint
CREATE INDEX `applications_workspace_applied_idx` ON `applications` (`workspace_id`,`applied_on`);--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX `board_columns_board_position_idx` ON `board_columns` (`board_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `board_columns_id_board_workspace_unique` ON `board_columns` (`id`,`board_id`,`workspace_id`);--> statement-breakpoint
CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`color` text,
	`background_image` text,
	`position` integer DEFAULT 0 NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `boards_workspace_position_idx` ON `boards` (`workspace_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `boards_id_workspace_unique` ON `boards` (`id`,`workspace_id`);--> statement-breakpoint
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
CREATE TABLE `card_labels` (
	`card_id` text NOT NULL,
	`label_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	PRIMARY KEY(`card_id`, `label_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`,`workspace_id`) REFERENCES `cards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`,`workspace_id`) REFERENCES `labels`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `card_labels_label_idx` ON `card_labels` (`label_id`);--> statement-breakpoint
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
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`board_id` text,
	`column_id` text,
	`title` text NOT NULL,
	`description` text,
	`position` integer NOT NULL,
	`priority` text DEFAULT 'none' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`,`workspace_id`) REFERENCES `boards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`column_id`,`board_id`,`workspace_id`) REFERENCES `board_columns`(`id`,`board_id`,`workspace_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cards_priority_valid" CHECK("cards"."priority" in ('none', 'low', 'medium', 'high', 'urgent')),
	CONSTRAINT "cards_placement_pair" CHECK(("cards"."board_id" is null) = ("cards"."column_id" is null))
);
--> statement-breakpoint
CREATE INDEX `cards_column_position_idx` ON `cards` (`column_id`,`position`);--> statement-breakpoint
CREATE INDEX `cards_workspace_archived_idx` ON `cards` (`workspace_id`,`archived_at`);--> statement-breakpoint
CREATE INDEX `cards_board_idx` ON `cards` (`board_id`);--> statement-breakpoint
CREATE INDEX `cards_workspace_updated_idx` ON `cards` (`workspace_id`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `cards_id_workspace_unique` ON `cards` (`id`,`workspace_id`);--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX `custom_field_definitions_board_idx` ON `custom_field_definitions` (`board_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `custom_field_definitions_board_name_unique` ON `custom_field_definitions` (`board_id`,lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX `custom_field_definitions_id_workspace_unique` ON `custom_field_definitions` (`id`,`workspace_id`);--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX `custom_field_values_field_idx` ON `custom_field_values` (`field_id`);--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`card_id` text NOT NULL,
	`application_id` text,
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
	`request_fingerprint` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action,
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
CREATE INDEX `interviews_application_idx` ON `interviews` (`application_id`);--> statement-breakpoint
CREATE INDEX `interviews_workspace_status_idx` ON `interviews` (`workspace_id`,`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'slate' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labels_workspace_name_unique` ON `labels` (`workspace_id`,lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX `labels_id_workspace_unique` ON `labels` (`id`,`workspace_id`);--> statement-breakpoint
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
	`kind` text DEFAULT 'general' NOT NULL,
	`due_on` text,
	`cancelled_at` integer,
	`request_fingerprint` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`,`workspace_id`) REFERENCES `cards`(`id`,`workspace_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tasks_priority_valid" CHECK("tasks"."priority" in ('none', 'low', 'medium', 'high', 'urgent')),
	CONSTRAINT "tasks_kind_valid" CHECK("tasks"."kind" in ('general', 'follow_up', 'preparation')),
	CONSTRAINT "tasks_title_valid" CHECK(length("tasks"."title") between 1 and 200),
	CONSTRAINT "tasks_description_valid" CHECK("tasks"."description" is null or length("tasks"."description") <= 2000),
	CONSTRAINT "tasks_not_done_and_cancelled" CHECK("tasks"."completed_at" is null or "tasks"."cancelled_at" is null),
	CONSTRAINT "tasks_due_on_valid" CHECK("tasks"."due_on" is null or ("tasks"."due_on" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' and date("tasks"."due_on") is "tasks"."due_on")),
	CONSTRAINT "tasks_fingerprint_valid" CHECK("tasks"."request_fingerprint" is null or length("tasks"."request_fingerprint") = 64)
);
--> statement-breakpoint
CREATE INDEX `tasks_open_due_idx` ON `tasks` (`workspace_id`,`due_on`,`id`) WHERE "tasks"."completed_at" is null and "tasks"."cancelled_at" is null;--> statement-breakpoint
CREATE INDEX `tasks_done_idx` ON `tasks` (`workspace_id`,`completed_at`,`id`) WHERE "tasks"."completed_at" is not null;--> statement-breakpoint
CREATE INDEX `tasks_card_idx` ON `tasks` (`card_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "users_email_lower" CHECK("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "workspace_members_role_valid" CHECK("workspace_members"."role" in ('owner', 'editor', 'viewer'))
);
--> statement-breakpoint
CREATE INDEX `workspace_members_user_idx` ON `workspace_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

--> statement-breakpoint
-- Integrità che i vincoli dichiarativi non esprimono (trigger) e vista della candidatura corrente.
CREATE TRIGGER `custom_field_values_board_match_insert` BEFORE INSERT ON `custom_field_values`
WHEN (SELECT `board_id` FROM `cards` WHERE `id` = NEW.card_id) IS NOT (SELECT `board_id` FROM `custom_field_definitions` WHERE `id` = NEW.field_id)
BEGIN
  SELECT RAISE(ABORT, 'custom_field_values: il campo appartiene a un''altra bacheca');
END;
--> statement-breakpoint
CREATE TRIGGER `custom_field_values_board_match_update` BEFORE UPDATE OF `card_id`, `field_id` ON `custom_field_values`
WHEN (SELECT `board_id` FROM `cards` WHERE `id` = NEW.card_id) IS NOT (SELECT `board_id` FROM `custom_field_definitions` WHERE `id` = NEW.field_id)
BEGIN
  SELECT RAISE(ABORT, 'custom_field_values: il campo appartiene a un''altra bacheca');
END;
--> statement-breakpoint
CREATE TRIGGER `cards_board_change_custom_values` BEFORE UPDATE OF `board_id` ON `cards`
WHEN EXISTS (
  SELECT 1 FROM `custom_field_values` v JOIN `custom_field_definitions` d ON d.`id` = v.`field_id`
  WHERE v.`card_id` = NEW.`id` AND d.`board_id` IS NOT NEW.`board_id`
)
BEGIN
  SELECT RAISE(ABORT, 'cards: rimuovere i valori dei campi personalizzati prima di cambiare bacheca');
END;
--> statement-breakpoint
CREATE TRIGGER `activity_events_tenant_insert` BEFORE INSERT ON `activity_events`
WHEN (NEW.card_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `cards` WHERE `id` = NEW.card_id AND `workspace_id` = NEW.workspace_id))
  OR (NEW.board_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `boards` WHERE `id` = NEW.board_id AND `workspace_id` = NEW.workspace_id))
  OR (NEW.actor_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `workspace_members` WHERE `workspace_id` = NEW.workspace_id AND `user_id` = NEW.actor_user_id))
BEGIN
  SELECT RAISE(ABORT, 'activity_events: riferimento a una risorsa di un altro workspace');
END;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TRIGGER `activity_events_application_match_insert` BEFORE INSERT ON `activity_events`
WHEN NEW.`application_id` IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'activity_events: la candidatura non esiste o appartiene a un altro workspace')
    WHERE NOT EXISTS (SELECT 1 FROM `applications` WHERE `id` = NEW.`application_id` AND `workspace_id` = NEW.`workspace_id`);
  SELECT RAISE(ABORT, 'activity_events: la candidatura appartiene a una opportunita diversa da card_id')
    WHERE NEW.`card_id` IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM `applications` WHERE `id` = NEW.`application_id` AND `opportunity_id` = NEW.`card_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `activity_events_application_match_update` BEFORE UPDATE OF `application_id`, `card_id`, `workspace_id` ON `activity_events`
WHEN NEW.`application_id` IS NOT NULL
  AND (NEW.`application_id` IS NOT OLD.`application_id` OR NEW.`card_id` IS NOT OLD.`card_id` OR NEW.`workspace_id` IS NOT OLD.`workspace_id`)
BEGIN
  SELECT RAISE(ABORT, 'activity_events: la candidatura non esiste o appartiene a un altro workspace')
    WHERE NOT EXISTS (SELECT 1 FROM `applications` WHERE `id` = NEW.`application_id` AND `workspace_id` = NEW.`workspace_id`);
  SELECT RAISE(ABORT, 'activity_events: la candidatura appartiene a una opportunita diversa da card_id')
    WHERE NEW.`card_id` IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM `applications` WHERE `id` = NEW.`application_id` AND `opportunity_id` = NEW.`card_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `interviews_application_match_insert` BEFORE INSERT ON `interviews`
WHEN NEW.`application_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `applications` WHERE `id` = NEW.`application_id` AND `opportunity_id` = NEW.`card_id` AND `workspace_id` = NEW.`workspace_id`)
BEGIN
  SELECT RAISE(ABORT, 'interviews: la candidatura deve appartenere alla stessa opportunità (card_id) e allo stesso workspace del colloquio');
END;
--> statement-breakpoint
CREATE TRIGGER `interviews_application_match_update` BEFORE UPDATE OF `application_id`, `card_id`, `workspace_id` ON `interviews`
WHEN NEW.`application_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `applications` WHERE `id` = NEW.`application_id` AND `opportunity_id` = NEW.`card_id` AND `workspace_id` = NEW.`workspace_id`)
BEGIN
  SELECT RAISE(ABORT, 'interviews: la candidatura deve appartenere alla stessa opportunità (card_id) e allo stesso workspace del colloquio');
END;
--> statement-breakpoint
-- Candidatura corrente di ogni opportunità: quella con la sequenza più alta.
CREATE VIEW `current_applications` AS
SELECT a.* FROM `applications` a
WHERE a.`sequence` = (SELECT max(b.`sequence`) FROM `applications` b WHERE b.`opportunity_id` = a.`opportunity_id`);
