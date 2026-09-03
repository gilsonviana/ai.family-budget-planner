import type { DateRange, Money } from "@family-finance/domain";

import type { BudgetSummary, BudgetSummaryService } from "./budget-summary.js";

export interface MetricChange {
  readonly absolute: Money;
  /** Signed basis points, where 10000 is 100%; null when the baseline is zero. */
  readonly percentageBasisPoints: number | null;
  readonly percentageUnavailableReason: "zeroBaseline" | null;
}
export interface PeriodComparison {
  readonly baseline: BudgetSummary;
  readonly baselineDays: number;
  readonly compared: BudgetSummary;
  readonly comparedDays: number;
  readonly expenseChange: MetricChange;
  readonly incomeChange: MetricChange;
  readonly projectedBalanceChange: MetricChange;
}

function change(baseline: Money, compared: Money): MetricChange {
  const absolute = compared.subtract(baseline);
  if (baseline.minorUnits === 0n) {
    return Object.freeze({
      absolute,
      percentageBasisPoints: null,
      percentageUnavailableReason: "zeroBaseline",
    });
  }
  const numerator = absolute.minorUnits * 10_000n;
  const denominator =
    baseline.minorUnits < 0n ? -baseline.minorUnits : baseline.minorUnits;
  const adjustment = numerator < 0n ? -(denominator / 2n) : denominator / 2n;
  return Object.freeze({
    absolute,
    percentageBasisPoints: Number((numerator + adjustment) / denominator),
    percentageUnavailableReason: null,
  });
}

export class PeriodComparisonService {
  constructor(private readonly summaries: BudgetSummaryService) {}

  async compare(
    familyId: string,
    baselinePeriod: DateRange,
    comparedPeriod: DateRange,
  ): Promise<PeriodComparison> {
    const [baseline, compared] = await Promise.all([
      this.summaries.summarize(familyId, baselinePeriod),
      this.summaries.summarize(familyId, comparedPeriod),
    ]);
    return Object.freeze({
      baseline,
      baselineDays: baselinePeriod.lengthInDays(),
      compared,
      comparedDays: comparedPeriod.lengthInDays(),
      expenseChange: change(
        baseline.expectedExpenses,
        compared.expectedExpenses,
      ),
      incomeChange: change(baseline.expectedIncome, compared.expectedIncome),
      projectedBalanceChange: change(
        baseline.projectedBalance,
        compared.projectedBalance,
      ),
    });
  }
}
