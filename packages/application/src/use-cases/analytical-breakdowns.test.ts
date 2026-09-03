import { ExpenseCategory, FamilyMember, Money } from "@family-finance/domain";
import { describe, expect, it } from "vitest";

import { buildAnalyticalBreakdowns } from "./analytical-breakdowns.js";

const usd = (value: string) => Money.fromDecimal(value, "USD");
describe("buildAnalyticalBreakdowns", () => {
  it("uses basis-point half-up rounding and reconciles to projection totals", () => {
    const result = buildAnalyticalBreakdowns(
      {
        byMember: [
          { key: "alex", total: usd("1") },
          { key: "sam", total: usd("2") },
        ],
        bySource: [],
        occurrences: [],
        period: {} as never,
        total: usd("3"),
      },
      {
        byCategory: [
          { categoryId: "food", total: usd("1") },
          { categoryId: "legacy", total: usd("2") },
          { categoryId: "missing", total: usd("3") },
        ],
        occurrences: [],
        period: {} as never,
        total: usd("6"),
      },
      [
        ExpenseCategory.create({ familyId: "f", id: "food", name: "Food" }),
        ExpenseCategory.create({
          active: false,
          familyId: "f",
          id: "legacy",
          name: "Legacy",
        }),
      ],
      [FamilyMember.create({ familyId: "f", id: "alex", name: "Alex" })],
    );
    expect(
      result.incomeByMember.map((item) => item.percentageBasisPoints),
    ).toEqual([3333, 6667]);
    expect(result.expensesByCategory.map((item) => item.status)).toEqual([
      "active",
      "inactive",
      "uncategorized",
    ]);
    expect(result.incomeByMember[1]?.status).toBe("missing");
    expect(result.expenseTotal.toDecimal()).toBe("6.00");
    expect(result.incomeTotal.toDecimal()).toBe("3.00");
  });
});
