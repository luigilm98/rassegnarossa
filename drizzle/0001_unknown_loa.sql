CREATE TABLE `public_news_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`headers` text NOT NULL,
	`expires_at` integer NOT NULL
);
