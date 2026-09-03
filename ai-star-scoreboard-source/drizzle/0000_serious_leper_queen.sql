CREATE TABLE `annual_targets` (
	`year` integer PRIMARY KEY NOT NULL,
	`stage` integer NOT NULL,
	`paper_sci` integer NOT NULL,
	`paper_top` integer NOT NULL,
	`patent_application_domestic` integer NOT NULL,
	`patent_application_international` integer NOT NULL,
	`patent_registration_domestic` integer NOT NULL,
	`patent_registration_international` integer NOT NULL,
	`open_source` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` text NOT NULL,
	`action` text NOT NULL,
	`summary` text NOT NULL,
	`changed_by_email` text NOT NULL,
	`changed_by_name` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `performance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`metric_type` text NOT NULL,
	`year` integer NOT NULL,
	`title` text NOT NULL,
	`organization` text NOT NULL,
	`project` text DEFAULT '' NOT NULL,
	`achievement_date` text DEFAULT '' NOT NULL,
	`identifier` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
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
INSERT INTO `annual_targets` (`year`, `stage`, `paper_sci`, `paper_top`, `patent_application_domestic`, `patent_application_international`, `patent_registration_domestic`, `patent_registration_international`, `open_source`) VALUES
  (2026, 1, 0, 8, 10, 0, 0, 0, 10),
  (2027, 1, 6, 16, 12, 4, 0, 0, 15),
  (2028, 2, 9, 20, 15, 6, 6, 0, 20),
  (2029, 2, 15, 26, 18, 8, 8, 2, 25),
  (2030, 3, 20, 30, 20, 10, 10, 4, 30),
  (2031, 3, 24, 40, 20, 12, 12, 6, 40);
