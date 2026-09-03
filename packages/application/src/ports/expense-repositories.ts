import type {
  DateRange,
  ExpenseCategory,
  ExpensePlan,
} from "@family-finance/domain";

export interface ExpensePlanQuery {
  readonly active?: boolean;
  readonly categoryId?: string;
  readonly familyId: string;
  readonly period?: DateRange;
}
export interface ExpenseCategoryRepository {
  create(category: ExpenseCategory): Promise<void>;
  getById(familyId: string, id: string): Promise<ExpenseCategory>;
  list(familyId: string): Promise<readonly ExpenseCategory[]>;
  update(category: ExpenseCategory): Promise<void>;
}
export interface ExpensePlanRepository {
  create(plan: ExpensePlan): Promise<void>;
  getById(familyId: string, id: string): Promise<ExpensePlan>;
  list(query: ExpensePlanQuery): Promise<readonly ExpensePlan[]>;
  update(plan: ExpensePlan): Promise<void>;
}
