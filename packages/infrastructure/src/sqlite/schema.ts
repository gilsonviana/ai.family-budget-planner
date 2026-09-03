import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** ISO 8601 calendar dates are stored as YYYY-MM-DD text, preserving date-only semantics. */
const recurrenceColumns = {
  recurrenceFrequency: text("recurrence_frequency", {
    enum: ["oneTime", "weekly", "monthly", "quarterly", "yearly"],
  }).notNull(),
  recurrenceStartDate: text("recurrence_start_date").notNull(),
  recurrenceEndDate: text("recurrence_end_date"),
  recurrenceMonthOverflow: text("recurrence_month_overflow", {
    enum: ["constrain", "reject"],
  })
    .notNull()
    .default("constrain"),
};

/** Minor units are decimal text so values are not limited by SQLite's signed 64-bit integer. */
const moneyColumns = {
  amountMinorUnits: text("amount_minor_units").notNull(),
  amountCurrency: text("amount_currency").notNull(),
  amountFractionDigits: integer("amount_fraction_digits").notNull(),
};

export const households = sqliteTable(
  "households",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    currency: text("currency").notNull(),
    locale: text("locale").notNull(),
    timeZone: text("time_zone").notNull(),
    weekStartsOn: integer("week_starts_on").notNull(),
  },
  (table) => [
    check(
      "households_week_starts_on_range",
      sql`${table.weekStartsOn} BETWEEN 0 AND 6`,
    ),
  ],
);

export const familyMembers = sqliteTable(
  "family_members",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => households.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
  },
  (table) => [
    uniqueIndex("family_members_family_id_id_unique").on(
      table.familyId,
      table.id,
    ),
    uniqueIndex("family_members_family_id_name_unique").on(
      table.familyId,
      table.name,
    ),
  ],
);

export const expenseCategories = sqliteTable(
  "expense_categories",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => households.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("expense_categories_family_id_id_unique").on(
      table.familyId,
      table.id,
    ),
    uniqueIndex("expense_categories_family_id_name_unique").on(
      table.familyId,
      table.name,
    ),
  ],
);

export const incomePlans = sqliteTable(
  "income_plans",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => households.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    memberId: text("member_id").notNull(),
    source: text("source").notNull(),
    ...moneyColumns,
    ...recurrenceColumns,
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    foreignKey({
      columns: [table.familyId, table.memberId],
      foreignColumns: [familyMembers.familyId, familyMembers.id],
      name: "income_plans_family_member_fk",
    }).onDelete("cascade"),
    check(
      "income_plans_amount_minor_units_positive",
      sql`${table.amountMinorUnits} GLOB '[1-9]*'`,
    ),
    check(
      "income_plans_fraction_digits_range",
      sql`${table.amountFractionDigits} BETWEEN 0 AND 18`,
    ),
  ],
);

export const expensePlans = sqliteTable(
  "expense_plans",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => households.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    categoryId: text("category_id").notNull(),
    name: text("name").notNull(),
    ...moneyColumns,
    ...recurrenceColumns,
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    foreignKey({
      columns: [table.familyId, table.categoryId],
      foreignColumns: [expenseCategories.familyId, expenseCategories.id],
      name: "expense_plans_family_category_fk",
    }).onDelete("restrict"),
    check(
      "expense_plans_amount_minor_units_positive",
      sql`${table.amountMinorUnits} GLOB '[1-9]*'`,
    ),
    check(
      "expense_plans_fraction_digits_range",
      sql`${table.amountFractionDigits} BETWEEN 0 AND 18`,
    ),
  ],
);

export const billPlans = sqliteTable(
  "bill_plans",
  {
    expensePlanId: text("expense_plan_id")
      .primaryKey()
      .references(() => expensePlans.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    remindersEnabled: integer("reminders_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    reminderLeadDays: integer("reminder_lead_days").notNull(),
  },
  (table) => [
    check(
      "bill_plans_reminder_lead_days_range",
      sql`${table.reminderLeadDays} BETWEEN 0 AND 365`,
    ),
  ],
);

export const billReminderRecipients = sqliteTable(
  "bill_reminder_recipients",
  {
    billPlanId: text("bill_plan_id")
      .notNull()
      .references(() => billPlans.expensePlanId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    email: text("email").notNull(),
  },
  (table) => [primaryKey({ columns: [table.billPlanId, table.email] })],
);

export const reminderDeliveries = sqliteTable(
  "reminder_deliveries",
  {
    billPlanId: text("bill_plan_id")
      .notNull()
      .references(() => billPlans.expensePlanId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    dueDate: text("due_date").notNull(),
    recipient: text("recipient").notNull(),
    status: text("status", {
      enum: ["claimed", "failed", "succeeded"],
    }).notNull(),
    attemptedAt: text("attempted_at").notNull(),
    providerMessageId: text("provider_message_id"),
    failureKind: text("failure_kind"),
  },
  (table) => [
    primaryKey({ columns: [table.billPlanId, table.dueDate, table.recipient] }),
  ],
);

export const financeSchema = {
  billPlans,
  billReminderRecipients,
  expenseCategories,
  expensePlans,
  familyMembers,
  households,
  incomePlans,
  reminderDeliveries,
};
