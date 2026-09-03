import { DateRange, LocalDate } from "./calendar.js";
import { ExpensePlan } from "./expense.js";
import type { Money } from "./money.js";

export type BillStatus = "due" | "overdue" | "upcoming";

export interface ReminderPreferencesInput {
  readonly enabled?: boolean;
  readonly leadDays: number;
  readonly recipients: readonly string[];
}

export interface BillOccurrence {
  readonly amount: Money;
  readonly billId: string;
  readonly dueDate: LocalDate;
  readonly reminderDate: LocalDate;
  readonly status: BillStatus;
}

export class InvalidBillError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidBillError";
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class BillReminderPreferences {
  public readonly enabled: boolean;
  public readonly leadDays: number;
  public readonly recipients: readonly string[];

  private constructor(
    enabled: boolean,
    leadDays: number,
    recipients: readonly string[],
  ) {
    this.enabled = enabled;
    this.leadDays = leadDays;
    this.recipients = Object.freeze([...recipients]);
    Object.freeze(this);
  }

  public static create(
    input: ReminderPreferencesInput,
  ): BillReminderPreferences {
    if (
      !Number.isInteger(input.leadDays) ||
      input.leadDays < 0 ||
      input.leadDays > 365
    ) {
      throw new InvalidBillError(
        "Reminder lead time must be an integer from 0 through 365 days",
      );
    }
    const recipients = [
      ...new Set(input.recipients.map((value) => value.trim().toLowerCase())),
    ];
    if (recipients.some((value) => !EMAIL_PATTERN.test(value))) {
      throw new InvalidBillError(
        "Every reminder recipient must be a valid email address",
      );
    }
    const enabled = input.enabled ?? true;
    if (enabled && recipients.length === 0) {
      throw new InvalidBillError(
        "Enabled reminders require at least one recipient",
      );
    }
    return new BillReminderPreferences(enabled, input.leadDays, recipients);
  }
}

/** A bill is an expense plan whose recurrence dates are its due dates. */
export class BillPlan {
  public readonly expense: ExpensePlan;
  public readonly reminders: BillReminderPreferences;

  private constructor(
    expense: ExpensePlan,
    reminders: BillReminderPreferences,
  ) {
    this.expense = expense;
    this.reminders = reminders;
    Object.freeze(this);
  }

  public static create(
    expense: ExpensePlan,
    reminders: BillReminderPreferences | ReminderPreferencesInput,
  ): BillPlan {
    return new BillPlan(
      expense,
      reminders instanceof BillReminderPreferences
        ? reminders
        : BillReminderPreferences.create(reminders),
    );
  }

  public statusOn(dueDate: LocalDate, today: LocalDate): BillStatus {
    const comparison = LocalDate.compare(dueDate, today);
    return comparison < 0 ? "overdue" : comparison === 0 ? "due" : "upcoming";
  }

  public reminderDateFor(dueDate: LocalDate): LocalDate {
    return dueDate.addDays(-this.reminders.leadDays);
  }

  public occurrencesIn(
    period: DateRange,
    today: LocalDate,
  ): readonly BillOccurrence[] {
    if (!this.expense.active) return [];
    return this.expense.recurrence.occurrencesIn(period).map((dueDate) =>
      Object.freeze({
        amount: this.expense.amount,
        billId: this.expense.id,
        dueDate,
        reminderDate: this.reminderDateFor(dueDate),
        status: this.statusOn(dueDate, today),
      }),
    );
  }
}
