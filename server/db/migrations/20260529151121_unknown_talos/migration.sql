ALTER TABLE `allowed_chats` ADD `last_message_at` integer;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_allowed_chats` (
	`id` text PRIMARY KEY,
	`chat_id` text NOT NULL UNIQUE,
	`topic` text DEFAULT '' NOT NULL,
	`chat_type` text DEFAULT '' NOT NULL,
	`allowed` integer DEFAULT false NOT NULL,
	`can_respond` integer DEFAULT false NOT NULL,
	`ms_subscription_id` text UNIQUE,
	`client_state` text,
	`subscription_expires_at` integer,
	`last_message_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_allowed_chats`(`id`, `chat_id`, `topic`, `chat_type`, `allowed`, `can_respond`, `ms_subscription_id`, `client_state`, `subscription_expires_at`, `created_at`) SELECT `id`, `chat_id`, `topic`, `chat_type`, `allowed`, `can_respond`, `ms_subscription_id`, `client_state`, `subscription_expires_at`, `created_at` FROM `allowed_chats`;--> statement-breakpoint
DROP TABLE `allowed_chats`;--> statement-breakpoint
ALTER TABLE `__new_allowed_chats` RENAME TO `allowed_chats`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`token` text PRIMARY KEY,
	`username` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sessions`(`token`, `username`, `role`, `created_at`) SELECT `token`, `username`, `role`, `created_at` FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `allowed_chats_client_state` ON `allowed_chats` (`client_state`);--> statement-breakpoint
CREATE INDEX `sessions_created_at_idx` ON `sessions` (`created_at`);