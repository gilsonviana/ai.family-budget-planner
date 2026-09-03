import { describe, expect, it } from "vitest";
import { LocalDate } from "./calendar.js";
import {
  ExpenseCategory,
  ExpensePlan,
  InvalidExpenseError,
} from "./expense.js";
import { Money } from "./money.js";
import { RecurrenceRule } from "./recurrence.js";

const recurrence = RecurrenceRule.monthly(LocalDate.fromISO("2026-01-01"));
const amount = (value: string) => Money.fromDecimal(value, "BRL");

describe("ExpenseCategory", () => {
  it("uses archival instead of deletion so references remain valid", () => {
    const category = ExpenseCategory.create({
      familyId: "family",
      id: "housing",
      name: " Housing ",
    });
    const archived = category.deactivate();
    expect(category.name).toBe("Housing");
    expect(archived.active).toBe(false);
    expect(archived.id).toBe(category.id);
  });
});

describe("ExpensePlan", () => {
  it("models one-time and recurring expenses with categories and active periods", () => {
    const recurring = ExpensePlan.create({
      amount: amount("100"),
      categoryId: "housing",
      familyId: "family",
      id: "rent",
      name: "Rent",
      recurrence,
    });
    const once = ExpensePlan.create({
      amount: amount("25"),
      categoryId: "gifts",
      familyId: "family",
      id: "gift",
      name: "Gift",
      recurrence: RecurrenceRule.oneTime(LocalDate.fromISO("2026-02-01")),
    });
    expect(recurring.recurrence.frequency).toBe("monthly");
    expect(once.recurrence.frequency).toBe("oneTime");
    expect(recurring.deactivate().active).toBe(false);
  });

  it("preserves identity while updating mutable planning fields", () => {
    const plan = ExpensePlan.create({
      amount: amount("100"),
      categoryId: "housing",
      familyId: "family",
      id: "rent",
      name: "Rent",
      recurrence,
    });
    const updated = plan.update({
      amount: amount("110"),
      categoryId: "fixed",
      name: "Monthly rent",
    });
    expect(updated.id).toBe("rent");
    expect(updated.amount.toDecimal()).toBe("110.00");
    expect(updated.categoryId).toBe("fixed");
  });

  it.each(["0", "-1"])("rejects non-positive expense amount %s", (value) => {
    expect(() =>
      ExpensePlan.create({
        amount: amount(value),
        categoryId: "housing",
        familyId: "family",
        id: "rent",
        name: "Rent",
        recurrence,
      }),
    ).toThrowError(InvalidExpenseError);
  });

  it("rejects invalid names and identifiers", () => {
    expect(() =>
      ExpenseCategory.create({
        familyId: "family",
        id: "bad id",
        name: "Name",
      }),
    ).toThrowError(InvalidExpenseError);
    expect(() =>
      ExpensePlan.create({
        amount: amount("1"),
        categoryId: "housing",
        familyId: "family",
        id: "rent",
        name: " ",
        recurrence,
      }),
    ).toThrowError(InvalidExpenseError);
  });
});
