ALTER TABLE `allowed_chats` ADD `ms_subscription_id` text;--> statement-breakpoint
ALTER TABLE `allowed_chats` ADD `client_state` text;--> statement-breakpoint
ALTER TABLE `allowed_chats` ADD `subscription_expires_at` integer;--> statement-breakpoint
DROP INDEX IF EXISTS `graph_subs_active_expires`;--> statement-breakpoint
CREATE INDEX `allowed_chats_client_state` ON `allowed_chats` (`client_state`);--> statement-breakpoint
DROP TABLE `graph_subscriptions`;