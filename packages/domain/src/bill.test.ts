import { describe, expect, it } from "vitest";
import { BillPlan, BillReminderPreferences, InvalidBillError } from "./bill.js";
import { DateRange, LocalDate } from "./calendar.js";
import { ExpensePlan } from "./expense.js";
import { Money } from "./money.js";
import { RecurrenceRule } from "./recurrence.js";

const date = (value: string) => LocalDate.fromISO(value);
function expense(start = "2026-01-31"): ExpensePlan {
  return ExpensePlan.create({
    amount: Money.fromDecimal("100", "BRL"),
    categoryId: "utilities",
    familyId: "family",
    id: "power",
    name: "Power",
    recurrence: RecurrenceRule.monthly(date(start)),
  });
}

describe("BillReminderPreferences", () => {
  it("normalizes and deduplicates recipients", () => {
    const preferences = BillReminderPreferences.create({
      leadDays: 3,
      recipients: [" USER@example.com ", "user@example.com"],
    });
    expect(preferences.recipients).toEqual(["user@example.com"]);
  });
  it.each([
    { leadDays: -1, recipients: ["user@example.com"] },
    { leadDays: 1.5, recipients: ["user@example.com"] },
    { leadDays: 366, recipients: ["user@example.com"] },
    { leadDays: 1, recipients: [] },
    { leadDays: 1, recipients: ["invalid"] },
  ])("rejects invalid reminder configuration %#", (input) => {
    expect(() => BillReminderPreferences.create(input)).toThrowError(
      InvalidBillError,
    );
  });
  it("allows no recipients when reminders are disabled", () => {
    expect(
      BillReminderPreferences.create({
        enabled: false,
        leadDays: 0,
        recipients: [],
      }).enabled,
    ).toBe(false);
  });
});

describe("BillPlan", () => {
  it("derives status from plan due dates and supplied today", () => {
    const bill = BillPlan.create(expense(), {
      leadDays: 5,
      recipients: ["user@example.com"],
    });
    expect(bill.statusOn(date("2026-02-28"), date("2026-02-27"))).toBe(
      "upcoming",
    );
    expect(bill.statusOn(date("2026-02-28"), date("2026-02-28"))).toBe("due");
    expect(bill.statusOn(date("2026-02-28"), date("2026-03-01"))).toBe(
      "overdue",
    );
  });
  it("handles end-of-month recurrence and reminder dates across boundaries", () => {
    const bill = BillPlan.create(expense(), {
      leadDays: 3,
      recipients: ["user@example.com"],
    });
    const occurrences = bill.occurrencesIn(
      DateRange.halfOpen(date("2026-01-01"), date("2026-04-01")),
      date("2026-02-01"),
    );
    expect(
      occurrences.map(({ dueDate, reminderDate }) => [
        dueDate.toString(),
        reminderDate.toString(),
      ]),
    ).toEqual([
      ["2026-01-31", "2026-01-28"],
      ["2026-02-28", "2026-02-25"],
      ["2026-03-31", "2026-03-28"],
    ]);
  });
  it("does not produce occurrences for an inactive expense plan", () => {
    const bill = BillPlan.create(expense().deactivate(), {
      leadDays: 1,
      recipients: ["user@example.com"],
    });
    expect(
      bill.occurrencesIn(
        DateRange.halfOpen(date("2026-01-01"), date("2026-02-01")),
        date("2026-01-01"),
      ),
    ).toEqual([]);
  });
});
