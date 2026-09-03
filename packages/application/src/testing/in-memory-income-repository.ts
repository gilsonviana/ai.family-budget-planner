import type { IncomePlan } from "@family-finance/domain";
import {
  RepositoryConflictError,
  RepositoryNotFoundError,
} from "../ports/family-repositories.js";
import type {
  IncomePlanQuery,
  IncomePlanRepository,
} from "../ports/income-repository.js";

function key(familyId: string, id: string): string {
  return `${familyId}\u0000${id}`;
}

export class InMemoryIncomePlanRepository implements IncomePlanRepository {
  readonly #plans = new Map<string, IncomePlan>();

  public async create(plan: IncomePlan): Promise<void> {
    const planKey = key(plan.familyId, plan.id);
    if (this.#plans.has(planKey))
      throw new RepositoryConflictError("incomePlan", plan.id);
    this.#plans.set(planKey, plan);
  }

  public async findById(
    familyId: string,
    id: string,
  ): Promise<IncomePlan | null> {
    return this.#plans.get(key(familyId, id)) ?? null;
  }

  public async getById(familyId: string, id: string): Promise<IncomePlan> {
    const plan = await this.findById(familyId, id);
    if (plan === null) throw new RepositoryNotFoundError("incomePlan", id);
    return plan;
  }

  public async list(query: IncomePlanQuery): Promise<readonly IncomePlan[]> {
    return [...this.#plans.values()]
      .filter((plan) => plan.familyId === query.familyId)
      .filter(
        (plan) =>
          query.memberId === undefined || plan.memberId === query.memberId,
      )
      .filter(
        (plan) => query.active === undefined || plan.active === query.active,
      )
      .filter(
        (plan) =>
          query.period === undefined ||
          plan.recurrence.occurrencesIn(query.period).length > 0,
      )
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  public async update(plan: IncomePlan): Promise<void> {
    const planKey = key(plan.familyId, plan.id);
    if (!this.#plans.has(planKey))
      throw new RepositoryNotFoundError("incomePlan", plan.id);
    this.#plans.set(planKey, plan);
  }
}
