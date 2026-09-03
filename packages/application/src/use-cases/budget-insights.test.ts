import { DateRange, LocalDate, Money } from "@family-finance/domain";
import { describe, expect, it, vi } from "vitest";

import { BudgetInsightService } from "./budget-insights.js";

describe("BudgetInsightService", () => {
  it("gives the model calculated facts and preserves them as source of truth", async () => {
    const period = DateRange.inclusive(
      LocalDate.fromISO("2026-01-01"),
      LocalDate.fromISO("2026-01-31"),
    );
    const summary = {
      currency: "USD",
      expectedExpenses: Money.fromDecimal("40", "USD"),
      expectedIncome: Money.fromDecimal("100", "USD"),
      period,
      projectedBalance: Money.fromDecimal("60", "USD"),
    };
    const generateStructured = vi.fn(async (_prompt, validator) => ({
      model: "test-model",
      provider: "test",
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      value: validator.parse({
        actions: ["Keep saving"],
        observations: ["Positive balance"],
        summary: "On track",
      }),
    }));
    const validator = {
      name: "BudgetInsight",
      parse: (value: unknown) =>
        value as { actions: string[]; observations: string[]; summary: string },
    };
    const result = await new BudgetInsightService(
      { generateStructured, generateText: vi.fn() },
      validator,
    ).generate(summary, {
      expenseTotal: summary.expectedExpenses,
      expensesByCategory: [],
      incomeByMember: [],
      incomeTotal: summary.expectedIncome,
    });
    expect(
      JSON.parse(generateStructured.mock.calls[0]?.[0].user).calculatedFacts
        .projectedBalance,
    ).toBe("60.00");
    expect(result.facts.projectedBalance).toBe("60.00");
    expect(result.insight.summary).toBe("On track");
  });
});
