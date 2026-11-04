CREATE TABLE `activity_events` (
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
	CONSTRAINT "activity_events_type_valid" CHECK("activity_events"."type" in ('card_created', 'card_moved', 'card_archived', 'card_restored', 'stage_changed', 'priority_changed', 'application_submitted', 'contact_logged', 'task_added', 'task_completed', 'application_closed'))
);
--> statement-breakpoint
CREATE INDEX `activity_events_workspace_time_idx` ON `activity_events` (`workspace_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `activity_events_card_time_idx` ON `activity_events` (`card_id`,`occurred_at`);--> statement-breakpoint
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
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "application_details_work_mode_valid" CHECK("application_details"."work_mode" is null or "application_details"."work_mode" in ('onsite', 'hybrid', 'remote')),
	CONSTRAINT "application_details_contract_valid" CHECK("application_details"."contract_type" is null or "application_details"."contract_type" in ('permanent', 'fixed_term', 'part_time', 'freelance', 'internship', 'apprenticeship', 'temporary', 'other')),
	CONSTRAINT "application_details_period_valid" CHECK("application_details"."salary_period" is null or "application_details"."salary_period" in ('hour', 'day', 'week', 'month', 'year')),
	CONSTRAINT "application_details_stage_valid" CHECK("application_details"."stage" is null or "application_details"."stage" in ('saved', 'preparing', 'applied', 'in_contact', 'interviewing', 'offer', 'closed')),
	CONSTRAINT "application_details_outcome_valid" CHECK("application_details"."outcome" is null or "application_details"."outcome" in ('pending', 'accepted', 'rejected', 'withdrawn', 'no_response', 'offer_declined')),
	CONSTRAINT "application_details_salary_range" CHECK("application_details"."salary_min" is null or "application_details"."salary_max" is null or "application_details"."salary_min" <= "application_details"."salary_max")
);
--> statement-breakpoint
CREATE INDEX `application_details_workspace_stage_idx` ON `application_details` (`workspace_id`,`stage`);--> statement-breakpoint
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
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "board_columns_category_valid" CHECK("board_columns"."category" is null or "board_columns"."category" in ('saved', 'preparing', 'applied', 'in_contact', 'interviewing', 'offer', 'closed'))
);
--> statement-breakpoint
CREATE INDEX `board_columns_board_position_idx` ON `board_columns` (`board_id`,`position`);--> statement-breakpoint
CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`color` text,
	`position` integer DEFAULT 0 NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `boards_workspace_position_idx` ON `boards` (`workspace_id`,`position`);--> statement-breakpoint
CREATE TABLE `card_labels` (
	`card_id` text NOT NULL,
	`label_id` text NOT NULL,
	PRIMARY KEY(`card_id`, `label_id`),
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `card_labels_label_idx` ON `card_labels` (`label_id`);--> statement-breakpoint
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
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`column_id`) REFERENCES `board_columns`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "cards_priority_valid" CHECK("cards"."priority" in ('none', 'low', 'medium', 'high', 'urgent'))
);
--> statement-breakpoint
CREATE INDEX `cards_column_position_idx` ON `cards` (`column_id`,`position`);--> statement-breakpoint
CREATE INDEX `cards_workspace_archived_idx` ON `cards` (`workspace_id`,`archived_at`);--> statement-breakpoint
CREATE INDEX `cards_board_idx` ON `cards` (`board_id`);--> statement-breakpoint
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
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "custom_field_definitions_type_valid" CHECK("custom_field_definitions"."type" in ('text', 'long_text', 'number', 'date', 'boolean', 'single_select', 'multi_select', 'url'))
);
--> statement-breakpoint
CREATE INDEX `custom_field_definitions_board_idx` ON `custom_field_definitions` (`board_id`,`position`);--> statement-breakpoint
CREATE TABLE `custom_field_values` (
	`card_id` text NOT NULL,
	`field_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`card_id`, `field_id`),
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `custom_field_definitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `custom_field_values_field_idx` ON `custom_field_values` (`field_id`);--> statement-breakpoint
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
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tasks_priority_valid" CHECK("tasks"."priority" in ('none', 'low', 'medium', 'high', 'urgent'))
);
--> statement-breakpoint
CREATE INDEX `tasks_workspace_open_due_idx` ON `tasks` (`workspace_id`,`completed_at`,`due_at`);--> statement-breakpoint
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
