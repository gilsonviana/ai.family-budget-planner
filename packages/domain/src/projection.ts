import { DateRange, LocalDate } from "./calendar.js";
import { Money } from "./money.js";
import { RecurrenceRule } from "./recurrence.js";

export interface FinancialPlan {
  readonly amount: Money;
  readonly id: string;
  readonly recurrence: RecurrenceRule;
}

export interface ProjectionInput {
  readonly currency: string;
  readonly fractionDigits?: number;
  readonly period: DateRange;
  readonly plans: readonly FinancialPlan[];
}

export interface ProjectedOccurrence {
  readonly amount: Money;
  readonly date: LocalDate;
  readonly planId: string;
}

export interface ProjectionResult {
  readonly occurrences: readonly ProjectedOccurrence[];
  readonly period: DateRange;
  readonly total: Money;
}

export class InvalidProjectionPlanError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidProjectionPlanError";
  }
}

export class DuplicateProjectionPlanError extends InvalidProjectionPlanError {
  public constructor(id: string) {
    super(
      `Projection plan identifiers must be unique; received duplicate ${id}`,
    );
    this.name = "DuplicateProjectionPlanError";
  }
}

function validatePlans(plans: readonly FinancialPlan[]): void {
  const identifiers = new Set<string>();
  for (const plan of plans) {
    if (plan.id.trim().length === 0) {
      throw new InvalidProjectionPlanError(
        "Projection plan identifiers must not be empty",
      );
    }
    if (identifiers.has(plan.id)) {
      throw new DuplicateProjectionPlanError(plan.id);
    }
    identifiers.add(plan.id);
  }
}

/** Projects plans into stable, date-ordered occurrences for a half-open period. */
export class ProjectionEngine {
  public project(input: ProjectionInput): ProjectionResult {
    validatePlans(input.plans);

    let total = Money.zero(input.currency, input.fractionDigits);
    const occurrences: ProjectedOccurrence[] = [];

    for (const plan of input.plans) {
      // Adding zero validates both currency and scale even when a plan has no
      // occurrence in the requested period.
      total = total.add(
        Money.fromMinorUnits(0n, plan.amount.currency, {
          fractionDigits: plan.amount.fractionDigits,
        }),
      );

      for (const date of plan.recurrence.occurrencesIn(input.period)) {
        const occurrence = Object.freeze({
          amount: plan.amount,
          date,
          planId: plan.id,
        });
        occurrences.push(occurrence);
        total = total.add(plan.amount);
      }
    }

    occurrences.sort((left, right) => {
      const dateOrder = LocalDate.compare(left.date, right.date);
      return dateOrder === 0
        ? left.planId.localeCompare(right.planId)
        : dateOrder;
    });

    return Object.freeze({
      occurrences: Object.freeze(occurrences),
      period: input.period,
      total,
    });
  }
}
