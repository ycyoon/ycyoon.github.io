CREATE TABLE `access_requests` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text DEFAULT '' NOT NULL,
	`reviewed_by_email` text DEFAULT '' NOT NULL,
	`reviewed_by_name` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `access_requests_status_idx` ON `access_requests` (`status`);--> statement-breakpoint
CREATE TABLE `training_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`school` text NOT NULL,
	`degree_course` text NOT NULL,
	`participation_start` text NOT NULL,
	`participation_end` text DEFAULT '' NOT NULL,
	`graduation_date` text DEFAULT '' NOT NULL,
	`project` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by_email` text NOT NULL,
	`created_by_name` text NOT NULL,
	`updated_by_email` text NOT NULL,
	`updated_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `training_participants_school_idx` ON `training_participants` (`school`);--> statement-breakpoint
CREATE INDEX `training_participants_degree_idx` ON `training_participants` (`degree_course`);--> statement-breakpoint
ALTER TABLE `annual_targets` ADD `beneficiary_bachelor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `annual_targets` ADD `beneficiary_master` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `annual_targets` ADD `beneficiary_doctor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `annual_targets` ADD `graduate_master` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `annual_targets` ADD `graduate_doctor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `entity_type` text DEFAULT 'performance' NOT NULL;--> statement-breakpoint
UPDATE `annual_targets` SET
	`beneficiary_bachelor` = CASE `year` WHEN 2026 THEN 10 WHEN 2027 THEN 15 WHEN 2028 THEN 15 WHEN 2029 THEN 20 WHEN 2030 THEN 20 WHEN 2031 THEN 20 ELSE `beneficiary_bachelor` END,
	`beneficiary_master` = CASE `year` WHEN 2026 THEN 20 WHEN 2027 THEN 30 WHEN 2028 THEN 30 WHEN 2029 THEN 30 WHEN 2030 THEN 30 WHEN 2031 THEN 30 ELSE `beneficiary_master` END,
	`beneficiary_doctor` = CASE `year` WHEN 2026 THEN 10 WHEN 2027 THEN 10 WHEN 2028 THEN 10 WHEN 2029 THEN 10 WHEN 2030 THEN 10 WHEN 2031 THEN 10 ELSE `beneficiary_doctor` END,
	`graduate_master` = CASE `year` WHEN 2026 THEN 0 WHEN 2027 THEN 20 WHEN 2028 THEN 25 WHEN 2029 THEN 25 WHEN 2030 THEN 25 WHEN 2031 THEN 25 ELSE `graduate_master` END,
	`graduate_doctor` = CASE `year` WHEN 2026 THEN 0 WHEN 2027 THEN 2 WHEN 2028 THEN 4 WHEN 2029 THEN 6 WHEN 2030 THEN 8 WHEN 2031 THEN 10 ELSE `graduate_doctor` END
WHERE `year` BETWEEN 2026 AND 2031;
