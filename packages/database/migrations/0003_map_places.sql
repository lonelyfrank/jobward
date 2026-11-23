CREATE TABLE `user_places` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'other' NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "user_places_name_length" CHECK(length("user_places"."name") between 1 and 60),
	CONSTRAINT "user_places_kind_valid" CHECK("user_places"."kind" in ('home', 'other')),
	CONSTRAINT "user_places_latitude_range" CHECK("user_places"."latitude" between -90 and 90),
	CONSTRAINT "user_places_longitude_range" CHECK("user_places"."longitude" between -180 and 180)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_places_user_name_unique` ON `user_places` (`user_id`,lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX `user_places_one_home` ON `user_places` (`user_id`) WHERE "user_places"."kind" = 'home';--> statement-breakpoint
CREATE INDEX `user_places_user_position_idx` ON `user_places` (`user_id`,`position`);--> statement-breakpoint
ALTER TABLE `application_details` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `application_details` ADD `longitude` real;--> statement-breakpoint
-- Coordinate della sede (D-07): entrambe o nessuna, negli intervalli geografici. Trigger e non CHECK:
-- un CHECK su una tabella esistente obbligherebbe a ricrearla (con i suoi trigger e le sue FK).
CREATE TRIGGER `application_details_coordinates_insert` BEFORE INSERT ON `application_details`
WHEN (NEW.`latitude` IS NULL) <> (NEW.`longitude` IS NULL)
  OR NEW.`latitude` NOT BETWEEN -90 AND 90
  OR NEW.`longitude` NOT BETWEEN -180 AND 180
BEGIN
  SELECT RAISE(ABORT, 'application_details: coordinate non valide');
END;
--> statement-breakpoint
CREATE TRIGGER `application_details_coordinates_update` BEFORE UPDATE OF `latitude`, `longitude` ON `application_details`
WHEN (NEW.`latitude` IS NULL) <> (NEW.`longitude` IS NULL)
  OR NEW.`latitude` NOT BETWEEN -90 AND 90
  OR NEW.`longitude` NOT BETWEEN -180 AND 180
BEGIN
  SELECT RAISE(ABORT, 'application_details: coordinate non valide');
END;
