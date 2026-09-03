CREATE TABLE `bill_plans` (
	`expense_plan_id` text PRIMARY KEY NOT NULL,
	`reminders_enabled` integer DEFAULT true NOT NULL,
	`reminder_lead_days` integer NOT NULL,
	FOREIGN KEY (`expense_plan_id`) REFERENCES `expense_plans`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "bill_plans_reminder_lead_days_range" CHECK("bill_plans"."reminder_lead_days" BETWEEN 0 AND 365)
);
--> statement-breakpoint
CREATE TABLE `bill_reminder_recipients` (
	`bill_plan_id` text NOT NULL,
	`email` text NOT NULL,
	PRIMARY KEY(`bill_plan_id`, `email`),
	FOREIGN KEY (`bill_plan_id`) REFERENCES `bill_plans`(`expense_plan_id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `households`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_categories_family_id_id_unique` ON `expense_categories` (`family_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `expense_categories_family_id_name_unique` ON `expense_categories` (`family_id`,`name`);--> statement-breakpoint
CREATE TABLE `expense_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`amount_minor_units` text NOT NULL,
	`amount_currency` text NOT NULL,
	`amount_fraction_digits` integer NOT NULL,
	`recurrence_frequency` text NOT NULL,
	`recurrence_start_date` text NOT NULL,
	`recurrence_end_date` text,
	`recurrence_month_overflow` text DEFAULT 'constrain' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `households`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`family_id`,`category_id`) REFERENCES `expense_categories`(`family_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "expense_plans_amount_minor_units_positive" CHECK("expense_plans"."amount_minor_units" GLOB '[1-9]*'),
	CONSTRAINT "expense_plans_fraction_digits_range" CHECK("expense_plans"."amount_fraction_digits" BETWEEN 0 AND 18)
);
--> statement-breakpoint
CREATE TABLE `family_members` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `households`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `family_members_family_id_id_unique` ON `family_members` (`family_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `family_members_family_id_name_unique` ON `family_members` (`family_id`,`name`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`locale` text NOT NULL,
	`time_zone` text NOT NULL,
	`week_starts_on` integer NOT NULL,
	CONSTRAINT "households_week_starts_on_range" CHECK("households"."week_starts_on" BETWEEN 0 AND 6)
);
--> statement-breakpoint
CREATE TABLE `income_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`member_id` text NOT NULL,
	`source` text NOT NULL,
	`amount_minor_units` text NOT NULL,
	`amount_currency` text NOT NULL,
	`amount_fraction_digits` integer NOT NULL,
	`recurrence_frequency` text NOT NULL,
	`recurrence_start_date` text NOT NULL,
	`recurrence_end_date` text,
	`recurrence_month_overflow` text DEFAULT 'constrain' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `households`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`family_id`,`member_id`) REFERENCES `family_members`(`family_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "income_plans_amount_minor_units_positive" CHECK("income_plans"."amount_minor_units" GLOB '[1-9]*'),
	CONSTRAINT "income_plans_fraction_digits_range" CHECK("income_plans"."amount_fraction_digits" BETWEEN 0 AND 18)
);
