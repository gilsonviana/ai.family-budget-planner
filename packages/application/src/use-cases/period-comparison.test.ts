import { DateRange, LocalDate, Money } from "@family-finance/domain";
import { describe, expect, it, vi } from "vitest";

import { PeriodComparisonService } from "./period-comparison.js";

const baselinePeriod = DateRange.inclusive(
  LocalDate.fromISO("2026-02-01"),
  LocalDate.fromISO("2026-02-28"),
);
const comparedPeriod = DateRange.inclusive(
  LocalDate.fromISO("2026-03-01"),
  LocalDate.fromISO("2026-03-31"),
);
const summary = (period: DateRange, income: string, expenses: string) => {
  const expectedIncome = Money.fromDecimal(income, "USD");
  const expectedExpenses = Money.fromDecimal(expenses, "USD");
  return {
    currency: "USD",
    expectedExpenses,
    expectedIncome,
    period,
    projectedBalance: expectedIncome.subtract(expectedExpenses),
  };
};

describe("PeriodComparisonService", () => {
  it("returns absolute and percentage changes with transparent period lengths", async () => {
    const summarize = vi
      .fn()
      .mockResolvedValueOnce(summary(baselinePeriod, "100", "50"))
      .mockResolvedValueOnce(summary(comparedPeriod, "125", "40"));
    const result = await new PeriodComparisonService({
      summarize,
    } as never).compare("f", baselinePeriod, comparedPeriod);
    expect([result.baselineDays, result.comparedDays]).toEqual([28, 31]);
    expect(result.incomeChange.absolute.toDecimal()).toBe("25.00");
    expect(result.incomeChange.percentageBasisPoints).toBe(2500);
    expect(result.expenseChange.percentageBasisPoints).toBe(-2000);
  });

  it("makes division by a zero baseline explicit", async () => {
    const summarize = vi
      .fn()
      .mockResolvedValueOnce(summary(baselinePeriod, "0", "0"))
      .mockResolvedValueOnce(summary(comparedPeriod, "10", "5"));
    const result = await new PeriodComparisonService({
      summarize,
    } as never).compare("f", baselinePeriod, comparedPeriod);
    expect(result.incomeChange.percentageBasisPoints).toBeNull();
    expect(result.incomeChange.percentageUnavailableReason).toBe(
      "zeroBaseline",
    );
  });
});
