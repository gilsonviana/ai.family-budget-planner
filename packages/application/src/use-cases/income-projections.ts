import {
  Money,
  ProjectionEngine,
  type DateRange,
  type IncomePlan,
  type LocalDate,
} from "@family-finance/domain";
import type { FamilyProfileRepository } from "../ports/family-repositories.js";
import type { IncomePlanRepository } from "../ports/income-repository.js";

export interface IncomeProjectionOccurrence {
  readonly amount: Money;
  readonly date: LocalDate;
  readonly incomePlanId: string;
  readonly memberId: string;
  readonly source: string;
}

export interface IncomeBreakdown {
  readonly key: string;
  readonly total: Money;
}

export interface IncomeProjectionResult {
  readonly byMember: readonly IncomeBreakdown[];
  readonly bySource: readonly IncomeBreakdown[];
  readonly occurrences: readonly IncomeProjectionOccurrence[];
  readonly period: DateRange;
  readonly total: Money;
}

function breakdown(
  occurrences: readonly IncomeProjectionOccurrence[],
  currency: string,
  select: (occurrence: IncomeProjectionOccurrence) => string,
): readonly IncomeBreakdown[] {
  const totals = new Map<string, Money>();
  for (const occurrence of occurrences) {
    const key = select(occurrence);
    totals.set(
      key,
      (totals.get(key) ?? Money.zero(currency)).add(occurrence.amount),
    );
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, total]) => Object.freeze({ key, total }));
}

export class IncomeProjectionService {
  public constructor(
    private readonly families: FamilyProfileRepository,
    private readonly incomes: IncomePlanRepository,
    private readonly engine = new ProjectionEngine(),
  ) {}

  public async project(
    familyId: string,
    period: DateRange,
  ): Promise<IncomeProjectionResult> {
    const family = await this.families.getById(familyId);
    const plans = await this.incomes.list({ active: true, familyId, period });
    const byId = new Map<string, IncomePlan>(
      plans.map((plan) => [plan.id, plan]),
    );
    const projection = this.engine.project({
      currency: family.settings.currency,
      period,
      plans: plans.map((plan) => ({
        amount: plan.amount,
        id: plan.id,
        recurrence: plan.recurrence,
      })),
    });
    const occurrences = projection.occurrences.map((occurrence) => {
      const plan = byId.get(occurrence.planId);
      if (plan === undefined)
        throw new Error(
          `Projection returned unknown plan ${occurrence.planId}`,
        );
      return Object.freeze({
        amount: occurrence.amount,
        date: occurrence.date,
        incomePlanId: plan.id,
        memberId: plan.memberId,
        source: plan.source,
      });
    });
    return Object.freeze({
      byMember: breakdown(
        occurrences,
        family.settings.currency,
        ({ memberId }) => memberId,
      ),
      bySource: breakdown(
        occurrences,
        family.settings.currency,
        ({ source }) => source,
      ),
      occurrences: Object.freeze(occurrences),
      period,
      total: projection.total,
    });
  }
}
