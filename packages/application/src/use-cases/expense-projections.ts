import {
  Money,
  ProjectionEngine,
  type DateRange,
  type ExpensePlan,
  type LocalDate,
} from "@family-finance/domain";
import type { ExpensePlanRepository } from "../ports/expense-repositories.js";
import type { FamilyProfileRepository } from "../ports/family-repositories.js";

export interface ExpenseProjectionOccurrence {
  readonly amount: Money;
  readonly categoryId: string;
  readonly date: LocalDate;
  readonly expensePlanId: string;
  readonly name: string;
}
export interface CategoryExpenseBreakdown {
  readonly categoryId: string;
  readonly total: Money;
}
export interface ExpenseProjectionResult {
  readonly byCategory: readonly CategoryExpenseBreakdown[];
  readonly occurrences: readonly ExpenseProjectionOccurrence[];
  readonly period: DateRange;
  readonly total: Money;
}

export class ExpenseProjectionService {
  public constructor(
    private readonly families: FamilyProfileRepository,
    private readonly expenses: ExpensePlanRepository,
    private readonly engine = new ProjectionEngine(),
  ) {}
  public async project(
    familyId: string,
    period: DateRange,
  ): Promise<ExpenseProjectionResult> {
    const family = await this.families.getById(familyId);
    const plans = await this.expenses.list({ active: true, familyId, period });
    const byId = new Map<string, ExpensePlan>(
      plans.map((plan) => [plan.id, plan]),
    );
    const projected = this.engine.project({
      currency: family.settings.currency,
      period,
      plans: plans.map((plan) => ({
        amount: plan.amount,
        id: plan.id,
        recurrence: plan.recurrence,
      })),
    });
    const occurrences = projected.occurrences.map((occurrence) => {
      const plan = byId.get(occurrence.planId);
      if (plan === undefined)
        throw new Error(
          `Projection returned unknown plan ${occurrence.planId}`,
        );
      return Object.freeze({
        amount: occurrence.amount,
        categoryId: plan.categoryId,
        date: occurrence.date,
        expensePlanId: plan.id,
        name: plan.name,
      });
    });
    const totals = new Map<string, Money>();
    for (const occurrence of occurrences) {
      totals.set(
        occurrence.categoryId,
        (
          totals.get(occurrence.categoryId) ??
          Money.zero(family.settings.currency)
        ).add(occurrence.amount),
      );
    }
    const byCategory = [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoryId, total]) => Object.freeze({ categoryId, total }));
    return Object.freeze({
      byCategory: Object.freeze(byCategory),
      occurrences: Object.freeze(occurrences),
      period,
      total: projected.total,
    });
  }
}
