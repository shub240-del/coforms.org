CREATE TABLE `spaceform_accounts` (
	`id` varchar(36) NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(160) NOT NULL,
	`passwordHash` varchar(255),
	`provider` varchar(32) NOT NULL DEFAULT 'password',
	`providerSubject` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spaceform_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `spaceform_accounts_email_unique` UNIQUE(`email`),
	CONSTRAINT `spaceform_accounts_provider_subject_unique` UNIQUE(`provider`,`providerSubject`)
);
--> statement-breakpoint
CREATE TABLE `spaceform_answers` (
	`id` varchar(36) NOT NULL,
	`responseId` varchar(36) NOT NULL,
	`questionId` varchar(36) NOT NULL,
	`value` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spaceform_answers_id` PRIMARY KEY(`id`),
	CONSTRAINT `spaceform_answers_response_question_unique` UNIQUE(`responseId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `spaceform_forms` (
	`id` varchar(36) NOT NULL,
	`workspaceId` varchar(36) NOT NULL,
	`ownerAccountId` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`slug` varchar(96) NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`theme` text,
	`settings` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`publishedAt` timestamp,
	CONSTRAINT `spaceform_forms_id` PRIMARY KEY(`id`),
	CONSTRAINT `spaceform_forms_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `spaceform_questions` (
	`id` varchar(36) NOT NULL,
	`formId` varchar(36) NOT NULL,
	`position` int NOT NULL,
	`type` varchar(48) NOT NULL,
	`label` varchar(255) NOT NULL,
	`description` text,
	`required` int NOT NULL DEFAULT 0,
	`archived` int NOT NULL DEFAULT 0,
	`settings` text,
	`logic` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spaceform_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spaceform_response_events` (
	`id` varchar(36) NOT NULL,
	`responseId` varchar(36) NOT NULL,
	`questionId` varchar(36),
	`eventType` varchar(48) NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spaceform_response_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spaceform_responses` (
	`id` varchar(36) NOT NULL,
	`formId` varchar(36) NOT NULL,
	`status` enum('in_progress','submitted') NOT NULL DEFAULT 'submitted',
	`respondentEmail` varchar(320),
	`metadata` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`submittedAt` timestamp,
	CONSTRAINT `spaceform_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spaceform_sessions` (
	`id` varchar(36) NOT NULL,
	`accountId` varchar(36) NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `spaceform_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `spaceform_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `spaceform_uploads` (
	`id` varchar(36) NOT NULL,
	`accountId` varchar(36),
	`formId` varchar(36),
	`responseId` varchar(36),
	`key` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`contentType` varchar(160),
	`byteSize` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spaceform_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spaceform_workspace_members` (
	`workspaceId` varchar(36) NOT NULL,
	`accountId` varchar(36) NOT NULL,
	`role` enum('owner','editor','viewer') NOT NULL DEFAULT 'viewer',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spaceform_workspace_members_workspaceId_accountId_pk` PRIMARY KEY(`workspaceId`,`accountId`)
);
--> statement-breakpoint
CREATE TABLE `spaceform_workspaces` (
	`id` varchar(36) NOT NULL,
	`ownerAccountId` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spaceform_workspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `spaceform_answers` ADD CONSTRAINT `spaceform_answers_responseId_spaceform_responses_id_fk` FOREIGN KEY (`responseId`) REFERENCES `spaceform_responses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_answers` ADD CONSTRAINT `spaceform_answers_questionId_spaceform_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `spaceform_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_forms` ADD CONSTRAINT `spaceform_forms_workspaceId_spaceform_workspaces_id_fk` FOREIGN KEY (`workspaceId`) REFERENCES `spaceform_workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_forms` ADD CONSTRAINT `spaceform_forms_ownerAccountId_spaceform_accounts_id_fk` FOREIGN KEY (`ownerAccountId`) REFERENCES `spaceform_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_questions` ADD CONSTRAINT `spaceform_questions_formId_spaceform_forms_id_fk` FOREIGN KEY (`formId`) REFERENCES `spaceform_forms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_response_events` ADD CONSTRAINT `spaceform_response_events_responseId_spaceform_responses_id_fk` FOREIGN KEY (`responseId`) REFERENCES `spaceform_responses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_response_events` ADD CONSTRAINT `spaceform_response_events_questionId_spaceform_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `spaceform_questions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_responses` ADD CONSTRAINT `spaceform_responses_formId_spaceform_forms_id_fk` FOREIGN KEY (`formId`) REFERENCES `spaceform_forms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_sessions` ADD CONSTRAINT `spaceform_sessions_accountId_spaceform_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `spaceform_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_uploads` ADD CONSTRAINT `spaceform_uploads_accountId_spaceform_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `spaceform_accounts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_uploads` ADD CONSTRAINT `spaceform_uploads_formId_spaceform_forms_id_fk` FOREIGN KEY (`formId`) REFERENCES `spaceform_forms`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_uploads` ADD CONSTRAINT `spaceform_uploads_responseId_spaceform_responses_id_fk` FOREIGN KEY (`responseId`) REFERENCES `spaceform_responses`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_workspace_members` ADD CONSTRAINT `sf_member_workspace_fk` FOREIGN KEY (`workspaceId`) REFERENCES `spaceform_workspaces`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_workspace_members` ADD CONSTRAINT `sf_member_account_fk` FOREIGN KEY (`accountId`) REFERENCES `spaceform_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spaceform_workspaces` ADD CONSTRAINT `sf_workspace_owner_fk` FOREIGN KEY (`ownerAccountId`) REFERENCES `spaceform_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `spaceform_answers_question_idx` ON `spaceform_answers` (`questionId`);--> statement-breakpoint
CREATE INDEX `spaceform_forms_workspace_idx` ON `spaceform_forms` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `spaceform_forms_owner_idx` ON `spaceform_forms` (`ownerAccountId`);--> statement-breakpoint
CREATE INDEX `spaceform_questions_form_position_idx` ON `spaceform_questions` (`formId`,`position`);--> statement-breakpoint
CREATE INDEX `spaceform_response_events_response_idx` ON `spaceform_response_events` (`responseId`);--> statement-breakpoint
CREATE INDEX `spaceform_responses_form_submitted_idx` ON `spaceform_responses` (`formId`,`submittedAt`);--> statement-breakpoint
CREATE INDEX `spaceform_sessions_account_idx` ON `spaceform_sessions` (`accountId`);--> statement-breakpoint
CREATE INDEX `spaceform_uploads_account_idx` ON `spaceform_uploads` (`accountId`);--> statement-breakpoint
CREATE INDEX `spaceform_uploads_form_idx` ON `spaceform_uploads` (`formId`);--> statement-breakpoint
CREATE INDEX `spaceform_uploads_response_idx` ON `spaceform_uploads` (`responseId`);--> statement-breakpoint
CREATE INDEX `spaceform_workspaces_owner_idx` ON `spaceform_workspaces` (`ownerAccountId`);