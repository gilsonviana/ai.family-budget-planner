import { DateRange, LocalDate, Money } from "@family-finance/domain";

import type { ExpenseProjectionService } from "./expense-projections.js";
import type { IncomeProjectionService } from "./income-projections.js";

export type ForecastGranularity = "weekly" | "monthly" | "quarterly" | "yearly";
export interface ForecastBucket {
  readonly balance: Money;
  readonly expectedExpenses: Money;
  readonly expectedIncome: Money;
  readonly period: DateRange;
  readonly status: "deficit" | "surplus" | "balanced";
}
export interface BudgetForecast {
  readonly buckets: readonly ForecastBucket[];
  readonly currency: string;
  readonly granularity: ForecastGranularity;
  readonly period: DateRange;
}

function nextCalendarBoundary(
  date: LocalDate,
  granularity: ForecastGranularity,
): LocalDate {
  if (granularity === "weekly") return date.addDays(7);
  if (granularity === "yearly") return LocalDate.of(date.year + 1, 1, 1);
  const currentIndex = date.year * 12 + date.month - 1;
  const nextIndex =
    granularity === "monthly"
      ? currentIndex + 1
      : (Math.floor(currentIndex / 3) + 1) * 3;
  const year = Math.floor(nextIndex / 12);
  return LocalDate.of(year, nextIndex - year * 12 + 1, 1);
}

function ranges(
  period: DateRange,
  granularity: ForecastGranularity,
): DateRange[] {
  const result: DateRange[] = [];
  let start = period.start;
  while (LocalDate.compare(start, period.endExclusive) < 0) {
    const boundary = nextCalendarBoundary(start, granularity);
    const end =
      LocalDate.compare(boundary, period.endExclusive) < 0
        ? boundary
        : period.endExclusive;
    result.push(DateRange.halfOpen(start, end));
    start = end;
  }
  return result;
}

export class BudgetForecastService {
  constructor(
    private readonly incomes: IncomeProjectionService,
    private readonly expenses: ExpenseProjectionService,
  ) {}

  async forecast(
    familyId: string,
    period: DateRange,
    granularity: ForecastGranularity,
  ): Promise<BudgetForecast> {
    const [income, expenses] = await Promise.all([
      this.incomes.project(familyId, period),
      this.expenses.project(familyId, period),
    ]);
    const buckets = ranges(period, granularity).map((bucketPeriod) => {
      let expectedIncome = Money.zero(
        income.total.currency,
        income.total.fractionDigits,
      );
      let expectedExpenses = Money.zero(
        expenses.total.currency,
        expenses.total.fractionDigits,
      );
      for (const occurrence of income.occurrences)
        if (bucketPeriod.contains(occurrence.date))
          expectedIncome = expectedIncome.add(occurrence.amount);
      for (const occurrence of expenses.occurrences)
        if (bucketPeriod.contains(occurrence.date))
          expectedExpenses = expectedExpenses.add(occurrence.amount);
      const balance = expectedIncome.subtract(expectedExpenses);
      return Object.freeze({
        balance,
        expectedExpenses,
        expectedIncome,
        period: bucketPeriod,
        status:
          balance.minorUnits < 0n
            ? "deficit"
            : balance.minorUnits > 0n
              ? "surplus"
              : "balanced",
      } satisfies ForecastBucket);
    });
    return Object.freeze({
      buckets: Object.freeze(buckets),
      currency: income.total.currency,
      granularity,
      period,
    });
  }
}
