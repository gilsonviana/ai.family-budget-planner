import type { DateRange, IncomePlan } from "@family-finance/domain";

export interface IncomePlanQuery {
  readonly active?: boolean;
  readonly familyId: string;
  readonly memberId?: string;
  readonly period?: DateRange;
}

export interface IncomePlanRepository {
  create(plan: IncomePlan): Promise<void>;
  findById(familyId: string, id: string): Promise<IncomePlan | null>;
  getById(familyId: string, id: string): Promise<IncomePlan>;
  list(query: IncomePlanQuery): Promise<readonly IncomePlan[]>;
  update(plan: IncomePlan): Promise<void>;
}
