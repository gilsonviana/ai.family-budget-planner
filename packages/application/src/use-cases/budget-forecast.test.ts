import { DateRange, LocalDate, Money } from "@family-finance/domain";
import { describe, expect, it, vi } from "vitest";

import {
  BudgetForecastService,
  type ForecastGranularity,
} from "./budget-forecast.js";

const usd = (amount: string) => Money.fromDecimal(amount, "USD");
const occurrence = (date: string, amount: string) => ({
  amount: usd(amount),
  date: LocalDate.fromISO(date),
});
describe("BudgetForecastService", () => {
  it.each<[ForecastGranularity, string[]]>([
    [
      "weekly",
      ["2026-01-29", "2026-02-05", "2026-02-12", "2026-02-19", "2026-02-26"],
    ],
    ["monthly", ["2026-01-29", "2026-02-01", "2026-03-01"]],
    ["quarterly", ["2026-01-29"]],
    ["yearly", ["2026-01-29"]],
  ])(
    "creates clipped %s buckets at expected boundaries",
    async (granularity, starts) => {
      const period = DateRange.halfOpen(
        LocalDate.fromISO("2026-01-29"),
        LocalDate.fromISO("2026-03-02"),
      );
      const incomes = {
        project: vi.fn().mockResolvedValue({
          occurrences: [occurrence("2026-02-01", "100")],
          period,
          total: usd("100"),
        }),
      };
      const expenses = {
        project: vi.fn().mockResolvedValue({
          occurrences: [occurrence("2026-02-28", "120")],
          period,
          total: usd("120"),
        }),
      };
      const result = await new BudgetForecastService(
        incomes as never,
        expenses as never,
      ).forecast("f", period, granularity);
      expect(
        result.buckets.map((bucket) => bucket.period.start.toString()),
      ).toEqual(starts);
      expect(result.buckets.at(-1)?.period.endExclusive.toString()).toBe(
        "2026-03-02",
      );
      expect(result.buckets.map((bucket) => bucket.status)).toContain(
        "deficit",
      );
    },
  );
});
