import {
  DateRange,
  FamilyProfile,
  LocalDate,
  Money,
  RecurrenceRule,
  type HouseholdSettingsInput,
} from "@family-finance/domain";
import { describe, expect, it } from "vitest";
import { RepositoryNotFoundError } from "../ports/family-repositories.js";
import {
  InMemoryExpenseCategoryRepository,
  InMemoryExpensePlanRepository,
} from "../testing/in-memory-expense-repositories.js";
import { InMemoryFamilyProfileRepository } from "../testing/in-memory-family-repositories.js";
import {
  ExpensePlanService,
  InactiveExpenseCategoryError,
} from "./expense-plans.js";

const date = (value: string) => LocalDate.fromISO(value);
async function setup(): Promise<ExpensePlanService> {
  const families = new InMemoryFamilyProfileRepository();
  const settings: HouseholdSettingsInput = {
    currency: "BRL",
    locale: "pt-BR",
    timeZone: "America/Sao_Paulo",
    weekStartsOn: 1,
  };
  await families.create(
    FamilyProfile.create({ id: "family", name: "Family", settings }),
  );
  return new ExpensePlanService(
    families,
    new InMemoryExpenseCategoryRepository(),
    new InMemoryExpensePlanRepository(),
  );
}
const plan = () => ({
  amount: Money.fromDecimal("100", "BRL"),
  categoryId: "housing",
  familyId: "family",
  id: "rent",
  name: "Rent",
  recurrence: RecurrenceRule.monthly(date("2026-01-01")),
});

describe("ExpensePlanService", () => {
  it("creates, updates, filters, retrieves, and deactivates expenses", async () => {
    const service = await setup();
    await service.createCategory({
      familyId: "family",
      id: "housing",
      name: "Housing",
    });
    await service.create(plan());
    expect(
      (
        await service.update({
          familyId: "family",
          id: "rent",
          name: "Monthly rent",
        })
      ).name,
    ).toBe("Monthly rent");
    const period = DateRange.halfOpen(date("2026-02-01"), date("2026-03-01"));
    expect(
      await service.list({
        familyId: "family",
        categoryId: "housing",
        active: true,
        period,
      }),
    ).toHaveLength(1);
    expect((await service.get("family", "rent")).id).toBe("rent");
    expect((await service.deactivate("family", "rent")).active).toBe(false);
  });
  it("rejects missing and inactive category references", async () => {
    const service = await setup();
    await expect(service.create(plan())).rejects.toBeInstanceOf(
      RepositoryNotFoundError,
    );
    await service.createCategory({
      familyId: "family",
      id: "housing",
      name: "Housing",
    });
    await service.deactivateCategory("family", "housing");
    await expect(service.create(plan())).rejects.toBeInstanceOf(
      InactiveExpenseCategoryError,
    );
  });
});
