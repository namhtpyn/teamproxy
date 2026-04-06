CREATE TABLE `graph_subscriptions` (
	`id` text PRIMARY KEY,
	`ms_subscription_id` text NOT NULL,
	`resource` text NOT NULL,
	`change_type` text NOT NULL,
	`client_state` text NOT NULL,
	`expires_at` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` text PRIMARY KEY,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`token_type` text DEFAULT 'Bearer',
	`scope` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY,
	`username` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
);
