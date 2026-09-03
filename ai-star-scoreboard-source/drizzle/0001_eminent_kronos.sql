CREATE INDEX `audit_logs_record_idx` ON `audit_logs` (`record_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `performance_records_year_idx` ON `performance_records` (`year`);--> statement-breakpoint
CREATE INDEX `performance_records_metric_idx` ON `performance_records` (`metric_type`);