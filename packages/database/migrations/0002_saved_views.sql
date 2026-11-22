CREATE TABLE `saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`scope` text DEFAULT 'opportunities' NOT NULL,
	`params` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "saved_views_name_length" CHECK(length("saved_views"."name") between 1 and 60),
	CONSTRAINT "saved_views_scope_valid" CHECK("saved_views"."scope" in ('opportunities')),
	CONSTRAINT "saved_views_params_length" CHECK(length("saved_views"."params") <= 2000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_views_workspace_name_unique` ON `saved_views` (`workspace_id`,lower("name"));--> statement-breakpoint
CREATE INDEX `saved_views_workspace_position_idx` ON `saved_views` (`workspace_id`,`position`);