CREATE TABLE `bookmarks` (
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`item_key` text NOT NULL,
	`payload` text NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`owner_id`, `kind`, `item_key`)
);
--> statement-breakpoint
CREATE INDEX `bookmarks_owner_updated_idx` ON `bookmarks` (`owner_id`,`updated_at`);