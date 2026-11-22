CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`website` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "companies_name_length" CHECK(length("companies"."name") between 1 and 120),
	CONSTRAINT "companies_key_length" CHECK(length("companies"."normalized_name") between 1 and 120)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_workspace_key_unique` ON `companies` (`workspace_id`,`normalized_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `companies_id_workspace_unique` ON `companies` (`id`,`workspace_id`);--> statement-breakpoint
ALTER TABLE `application_details` ADD `company_id` text REFERENCES companies(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `application_details_company_idx` ON `application_details` (`company_id`);--> statement-breakpoint
-- L'azienda collegata deve appartenere allo stesso workspace dell'opportunità.
CREATE TRIGGER `application_details_company_tenant_insert` BEFORE INSERT ON `application_details`
WHEN NEW.`company_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `companies` WHERE `id` = NEW.`company_id` AND `workspace_id` = NEW.`workspace_id`)
BEGIN
  SELECT RAISE(ABORT, 'application_details: azienda di un altro workspace');
END;
--> statement-breakpoint
CREATE TRIGGER `application_details_company_tenant_update` BEFORE UPDATE OF `company_id`, `workspace_id` ON `application_details`
WHEN NEW.`company_id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `companies` WHERE `id` = NEW.`company_id` AND `workspace_id` = NEW.`workspace_id`)
BEGIN
  SELECT RAISE(ABORT, 'application_details: azienda di un altro workspace');
END;
