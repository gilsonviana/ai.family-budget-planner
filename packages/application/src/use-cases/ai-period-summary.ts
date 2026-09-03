import type { DateRange } from "@family-finance/domain";

import type { AnalyticalBreakdowns } from "./analytical-breakdowns.js";
import type {
  BudgetInsightResult,
  BudgetInsightService,
} from "./budget-insights.js";
import type { BudgetSummary, BudgetSummaryService } from "./budget-summary.js";

export interface PeriodAnalyticsService {
  analyze(familyId: string, period: DateRange): Promise<AnalyticalBreakdowns>;
}
export interface AiPeriodSummaryResult {
  readonly calculated: {
    readonly breakdowns: AnalyticalBreakdowns;
    readonly summary: BudgetSummary;
  };
  readonly generated: BudgetInsightResult;
  readonly factsSuppliedToLlm: readonly string[];
}

/** Adapter-facing orchestration that keeps calculations visibly separate from generated prose. */
export class AiPeriodSummaryService {
  constructor(
    private readonly summaries: BudgetSummaryService,
    private readonly analytics: PeriodAnalyticsService,
    private readonly insights: BudgetInsightService,
  ) {}

  async summarize(
    familyId: string,
    period: DateRange,
  ): Promise<AiPeriodSummaryResult> {
    const [summary, breakdowns] = await Promise.all([
      this.summaries.summarize(familyId, period),
      this.analytics.analyze(familyId, period),
    ]);
    const generated = await this.insights.generate(summary, breakdowns);
    return Object.freeze({
      calculated: Object.freeze({ breakdowns, summary }),
      factsSuppliedToLlm: Object.freeze(Object.keys(generated.facts).sort()),
      generated,
    });
  }
}
