import { DateRange, LocalDate, Money } from "@family-finance/domain";
import { describe, expect, it, vi } from "vitest";

import { BudgetSummaryService } from "./budget-summary.js";

const period = DateRange.inclusive(
  LocalDate.fromISO("2026-01-01"),
  LocalDate.fromISO("2026-01-31"),
);
function projection(total: Money) {
  return {
    byCategory: [],
    byMember: [],
    bySource: [],
    occurrences: [],
    period,
    total,
  };
}

describe("BudgetSummaryService", () => {
  it.each([
    ["zero income", "0", "400", "-400.00"],
    ["zero expenses", "900", "0", "900.00"],
    ["surplus", "900", "400", "500.00"],
  ])(
    "summarizes deterministic projections with %s",
    async (_name, income, expense, balance) => {
      const service = new BudgetSummaryService(
        {
          project: vi
            .fn()
            .mockResolvedValue(projection(Money.fromDecimal(income, "USD"))),
        } as never,
        {
          project: vi
            .fn()
            .mockResolvedValue(projection(Money.fromDecimal(expense, "USD"))),
        } as never,
      );
      const result = await service.summarize("family", period);
      expect(result.currency).toBe("USD");
      expect(result.period).toBe(period);
      expect(result.projectedBalance.toDecimal()).toBe(balance);
    },
  );
});
