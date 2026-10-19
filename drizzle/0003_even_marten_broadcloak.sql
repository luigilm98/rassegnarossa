CREATE TABLE `community_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`references_text` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`language` text NOT NULL,
	`created_at` integer NOT NULL,
	`withdrawn` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `community_created_idx` ON `community_proposals` (`created_at`);--> statement-breakpoint
CREATE INDEX `community_owner_created_idx` ON `community_proposals` (`owner_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `community_votes` (
	`proposal_id` text NOT NULL,
	`voter_key` text NOT NULL,
	`value` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`proposal_id`, `voter_key`)
);
