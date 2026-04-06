CREATE TABLE `allowed_chats` (
	`id` text PRIMARY KEY,
	`chat_id` text NOT NULL UNIQUE,
	`topic` text DEFAULT '' NOT NULL,
	`chat_type` text DEFAULT '' NOT NULL,
	`allowed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_graph_subscriptions` (
	`id` text PRIMARY KEY,
	`ms_subscription_id` text NOT NULL UNIQUE,
	`resource` text NOT NULL,
	`change_type` text NOT NULL,
	`client_state` text NOT NULL UNIQUE,
	`expires_at` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_graph_subscriptions`(`id`, `ms_subscription_id`, `resource`, `change_type`, `client_state`, `expires_at`, `is_active`, `created_at`) SELECT `id`, `ms_subscription_id`, `resource`, `change_type`, `client_state`, `expires_at`, `is_active`, `created_at` FROM `graph_subscriptions`;--> statement-breakpoint
DROP TABLE `graph_subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_graph_subscriptions` RENAME TO `graph_subscriptions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_oauth_tokens` (
	`id` text PRIMARY KEY,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`token_type` text DEFAULT 'Bearer' NOT NULL,
	`scope` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_oauth_tokens`(`id`, `access_token`, `refresh_token`, `token_type`, `scope`, `expires_at`, `created_at`, `updated_at`, `is_active`) SELECT `id`, `access_token`, `refresh_token`, `token_type`, `scope`, `expires_at`, `created_at`, `updated_at`, `is_active` FROM `oauth_tokens`;--> statement-breakpoint
DROP TABLE `oauth_tokens`;--> statement-breakpoint
ALTER TABLE `__new_oauth_tokens` RENAME TO `oauth_tokens`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `graph_subs_active_expires` ON `graph_subscriptions` (`is_active`,`expires_at`);--> statement-breakpoint
CREATE INDEX `oauth_tokens_active_expires` ON `oauth_tokens` (`is_active`,`expires_at`);