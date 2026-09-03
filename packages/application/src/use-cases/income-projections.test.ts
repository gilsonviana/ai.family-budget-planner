import {
  DateRange,
  FamilyProfile,
  IncomePlan,
  LocalDate,
  Money,
  RecurrenceRule,
  type HouseholdSettingsInput,
} from "@family-finance/domain";
import { describe, expect, it } from "vitest";
import { InMemoryFamilyProfileRepository } from "../testing/in-memory-family-repositories.js";
import { InMemoryIncomePlanRepository } from "../testing/in-memory-income-repository.js";
import { IncomeProjectionService } from "./income-projections.js";

const date = (value: string): LocalDate => LocalDate.fromISO(value);
const settings: HouseholdSettingsInput = {
  currency: "BRL",
  locale: "pt-BR",
  timeZone: "America/Sao_Paulo",
  weekStartsOn: 1,
};

describe("IncomeProjectionService", () => {
  it("returns normalized occurrences, totals, and reconciled breakdowns", async () => {
    const families = new InMemoryFamilyProfileRepository();
    const incomes = new InMemoryIncomePlanRepository();
    await families.create(
      FamilyProfile.create({ id: "family", name: "Family", settings }),
    );
    const makePlan = (
      id: string,
      memberId: string,
      source: string,
      amount: string,
    ) =>
      IncomePlan.create({
        amount: Money.fromDecimal(amount, "BRL"),
        familyId: "family",
        id,
        memberId,
        recurrence: RecurrenceRule.monthly(date("2026-01-01")),
        source,
      });
    await incomes.create(makePlan("salary-a", "member-a", "Salary", "100"));
    await incomes.create(makePlan("salary-b", "member-b", "Salary", "200"));
    await incomes.create(makePlan("rent", "member-a", "Rental", "50"));
    await incomes.create(
      makePlan("inactive", "member-a", "Old", "999").deactivate(),
    );
    const period = DateRange.halfOpen(date("2026-01-01"), date("2026-03-01"));
    const result = await new IncomeProjectionService(families, incomes).project(
      "family",
      period,
    );
    expect(result.occurrences).toHaveLength(6);
    expect(result.total.toDecimal()).toBe("700.00");
    expect(
      result.byMember.map(({ key, total }) => [key, total.toDecimal()]),
    ).toEqual([
      ["member-a", "300.00"],
      ["member-b", "400.00"],
    ]);
    expect(
      result.bySource.map(({ key, total }) => [key, total.toDecimal()]),
    ).toEqual([
      ["Rental", "100.00"],
      ["Salary", "600.00"],
    ]);
  });
});
