CREATE TABLE `instance_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`level` varchar(8) NOT NULL DEFAULT 'info',
	`message` text NOT NULL,
	`metadata` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `instance_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`plugin_id` varchar(64) NOT NULL,
	`amount` int NOT NULL,
	`provider` varchar(32),
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`external_order_id` varchar(128),
	`paid_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`username` varchar(64) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `plugin_catalog` (
	`id` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`category` varchar(32) NOT NULL,
	`tier` varchar(16) NOT NULL DEFAULT 'free',
	`price_monthly` int DEFAULT 0,
	`price_yearly` int DEFAULT 0,
	`dependencies` text,
	`version` varchar(32) NOT NULL DEFAULT '1.0.0',
	`enabled` int DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plugin_catalog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`plugin_id` varchar(64) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`plan_type` varchar(16) NOT NULL DEFAULT 'monthly',
	`started_at` timestamp DEFAULT (now()),
	`expires_at` timestamp,
	`is_enabled` int DEFAULT 1,
	`config_json` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_tenant_id_plugin_id_unique` UNIQUE(`tenant_id`,`plugin_id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` varchar(36) NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`bot_token` text NOT NULL,
	`verify_token` varchar(128),
	`encrypt_key` varchar(64),
	`assigned_port` int,
	`status` varchar(16) NOT NULL DEFAULT 'stopped',
	`pid` int,
	`last_heartbeat` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_tenant` ON `instance_logs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_created` ON `instance_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_user` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_tenant` ON `payments` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_tenant` ON `subscriptions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_user_id` ON `tenants` (`user_id`);