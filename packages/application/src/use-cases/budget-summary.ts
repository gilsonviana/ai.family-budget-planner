import type { DateRange, Money } from "@family-finance/domain";

import type { ExpenseProjectionService } from "./expense-projections.js";
import type { IncomeProjectionService } from "./income-projections.js";

export interface BudgetSummary {
  readonly currency: string;
  readonly expectedExpenses: Money;
  readonly expectedIncome: Money;
  readonly period: DateRange;
  readonly projectedBalance: Money;
}

export class BudgetSummaryService {
  constructor(
    private readonly incomes: IncomeProjectionService,
    private readonly expenses: ExpenseProjectionService,
  ) {}

  async summarize(familyId: string, period: DateRange): Promise<BudgetSummary> {
    const [income, expenses] = await Promise.all([
      this.incomes.project(familyId, period),
      this.expenses.project(familyId, period),
    ]);
    return Object.freeze({
      currency: income.total.currency,
      expectedExpenses: expenses.total,
      expectedIncome: income.total,
      period,
      projectedBalance: income.total.subtract(expenses.total),
    });
  }
}
