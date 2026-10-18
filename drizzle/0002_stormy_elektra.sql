CREATE TABLE `reading_progress` (
	`owner_id` text NOT NULL,
	`book_id` text NOT NULL,
	`edition` text NOT NULL,
	`chapter` integer NOT NULL,
	`page` integer NOT NULL,
	`scroll` integer DEFAULT 0 NOT NULL,
	`revision` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`owner_id`, `book_id`, `edition`)
);
