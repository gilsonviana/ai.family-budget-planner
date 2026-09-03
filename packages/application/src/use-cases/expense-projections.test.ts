import {
  DateRange,
  ExpensePlan,
  FamilyProfile,
  LocalDate,
  Money,
  RecurrenceRule,
  type HouseholdSettingsInput,
} from "@family-finance/domain";
import { describe, expect, it } from "vitest";
import { InMemoryExpensePlanRepository } from "../testing/in-memory-expense-repositories.js";
import { InMemoryFamilyProfileRepository } from "../testing/in-memory-family-repositories.js";
import { ExpenseProjectionService } from "./expense-projections.js";

const date = (value: string) => LocalDate.fromISO(value);
describe("ExpenseProjectionService", () => {
  it("returns normalized expense occurrences, totals, and category breakdowns", async () => {
    const families = new InMemoryFamilyProfileRepository();
    const expenses = new InMemoryExpensePlanRepository();
    const settings: HouseholdSettingsInput = {
      currency: "BRL",
      locale: "pt-BR",
      timeZone: "America/Sao_Paulo",
      weekStartsOn: 1,
    };
    await families.create(
      FamilyProfile.create({ id: "family", name: "Family", settings }),
    );
    const make = (id: string, categoryId: string, amount: string) =>
      ExpensePlan.create({
        amount: Money.fromDecimal(amount, "BRL"),
        categoryId,
        familyId: "family",
        id,
        name: id,
        recurrence: RecurrenceRule.monthly(date("2026-01-01")),
      });
    await expenses.create(make("rent", "housing", "100"));
    await expenses.create(make("power", "housing", "20"));
    await expenses.create(make("food", "groceries", "50"));
    await expenses.create(make("old", "other", "999").deactivate());
    const period = DateRange.halfOpen(date("2026-01-01"), date("2026-03-01"));
    const result = await new ExpenseProjectionService(
      families,
      expenses,
    ).project("family", period);
    expect(result.occurrences).toHaveLength(6);
    expect(result.total.toDecimal()).toBe("340.00");
    expect(
      result.byCategory.map(({ categoryId, total }) => [
        categoryId,
        total.toDecimal(),
      ]),
    ).toEqual([
      ["groceries", "100.00"],
      ["housing", "240.00"],
    ]);
  });
});
