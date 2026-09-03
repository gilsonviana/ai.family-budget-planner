import type {
  LlmProvider,
  LlmUsage,
  StructuredResultValidator,
} from "../ports/llm-provider.js";
import type { AnalyticalBreakdowns } from "./analytical-breakdowns.js";
import type { BudgetSummary } from "./budget-summary.js";

export interface GeneratedBudgetInsight {
  readonly actions: readonly string[];
  readonly observations: readonly string[];
  readonly summary: string;
}
export interface DeterministicBudgetFacts {
  readonly currency: string;
  readonly expectedExpenses: string;
  readonly expectedIncome: string;
  readonly expensesByCategory: readonly {
    readonly name: string;
    readonly total: string;
  }[];
  readonly incomeByMember: readonly {
    readonly name: string | null;
    readonly total: string;
  }[];
  readonly periodEndExclusive: string;
  readonly periodStart: string;
  readonly projectedBalance: string;
}
export interface BudgetInsightResult {
  readonly facts: DeterministicBudgetFacts;
  readonly insight: GeneratedBudgetInsight;
  readonly model: string;
  readonly provider: string;
  readonly usage: LlmUsage;
}

export class BudgetInsightService {
  constructor(
    private readonly llm: LlmProvider,
    private readonly validator: StructuredResultValidator<GeneratedBudgetInsight>,
  ) {}

  async generate(
    summary: BudgetSummary,
    breakdowns: AnalyticalBreakdowns,
  ): Promise<BudgetInsightResult> {
    const facts = Object.freeze({
      currency: summary.currency,
      expectedExpenses: summary.expectedExpenses.toDecimal(),
      expectedIncome: summary.expectedIncome.toDecimal(),
      expensesByCategory: breakdowns.expensesByCategory.map((item) => ({
        name: item.name,
        total: item.total.toDecimal(),
      })),
      incomeByMember: breakdowns.incomeByMember.map((item) => ({
        name: item.name,
        total: item.total.toDecimal(),
      })),
      periodEndExclusive: summary.period.endExclusive.toString(),
      periodStart: summary.period.start.toString(),
      projectedBalance: summary.projectedBalance.toDecimal(),
    });
    const generated = await this.llm.generateStructured(
      {
        system:
          "Explain the supplied calculated facts. Never recalculate, alter, or invent financial amounts.",
        user: JSON.stringify({ calculatedFacts: facts }),
      },
      this.validator,
    );
    return Object.freeze({
      facts,
      insight: generated.value,
      model: generated.model,
      provider: generated.provider,
      usage: generated.usage,
    });
  }
}
