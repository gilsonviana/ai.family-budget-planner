import { DateRange, LocalDate, Money } from "@family-finance/domain";
import { describe, expect, it, vi } from "vitest";

import { BudgetInsightService } from "./budget-insights.js";
import { AiPeriodSummaryService } from "./ai-period-summary.js";

describe("AiPeriodSummaryService", () => {
  it("separates calculated facts from narrative using a fake provider", async () => {
    const period = DateRange.inclusive(
      LocalDate.fromISO("2026-09-01"),
      LocalDate.fromISO("2026-09-30"),
    );
    const income = Money.fromDecimal("100", "USD");
    const expenses = Money.fromDecimal("70", "USD");
    const summary = {
      currency: "USD",
      expectedExpenses: expenses,
      expectedIncome: income,
      period,
      projectedBalance: income.subtract(expenses),
    };
    const breakdowns = {
      expenseTotal: expenses,
      expensesByCategory: [],
      incomeByMember: [],
      incomeTotal: income,
    };
    const fakeProvider = {
      generateText: vi.fn(),
      generateStructured: vi.fn(async (_prompt, validator) => ({
        model: "fake",
        provider: "fake",
        usage: { inputTokens: 5, outputTokens: 4, totalTokens: 9 },
        value: validator.parse({
          actions: ["Review subscriptions"],
          observations: ["Positive projected balance"],
          summary: "Spending is within income.",
        }),
      })),
    };
    const insights = new BudgetInsightService(fakeProvider, {
      name: "Insight",
      parse: (value) =>
        value as { actions: string[]; observations: string[]; summary: string },
    });
    const result = await new AiPeriodSummaryService(
      { summarize: vi.fn().mockResolvedValue(summary) } as never,
      { analyze: vi.fn().mockResolvedValue(breakdowns) },
      insights,
    ).summarize("family", period);
    expect(result.calculated.summary.projectedBalance.toDecimal()).toBe(
      "30.00",
    );
    expect(result.generated.insight.summary).toBe("Spending is within income.");
    expect(result.factsSuppliedToLlm).toContain("projectedBalance");
  });
});
