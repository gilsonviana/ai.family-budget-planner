CREATE TABLE `reminder_deliveries` (
	`bill_plan_id` text NOT NULL,
	`due_date` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text NOT NULL,
	`attempted_at` text NOT NULL,
	`provider_message_id` text,
	`failure_kind` text,
	PRIMARY KEY(`bill_plan_id`, `due_date`, `recipient`),
	FOREIGN KEY (`bill_plan_id`) REFERENCES `bill_plans`(`expense_plan_id`) ON UPDATE cascade ON DELETE cascade
);
