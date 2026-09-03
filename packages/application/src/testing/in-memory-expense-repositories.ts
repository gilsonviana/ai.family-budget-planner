import type { ExpenseCategory, ExpensePlan } from "@family-finance/domain";
import type {
  ExpenseCategoryRepository,
  ExpensePlanQuery,
  ExpensePlanRepository,
} from "../ports/expense-repositories.js";
import {
  RepositoryConflictError,
  RepositoryNotFoundError,
} from "../ports/family-repositories.js";

const key = (familyId: string, id: string): string => `${familyId}\u0000${id}`;

export class InMemoryExpenseCategoryRepository implements ExpenseCategoryRepository {
  readonly #values = new Map<string, ExpenseCategory>();
  public async create(value: ExpenseCategory): Promise<void> {
    const k = key(value.familyId, value.id);
    if (this.#values.has(k))
      throw new RepositoryConflictError("expenseCategory", value.id);
    this.#values.set(k, value);
  }
  public async getById(familyId: string, id: string): Promise<ExpenseCategory> {
    const value = this.#values.get(key(familyId, id));
    if (value === undefined)
      throw new RepositoryNotFoundError("expenseCategory", id);
    return value;
  }
  public async list(familyId: string): Promise<readonly ExpenseCategory[]> {
    return [...this.#values.values()]
      .filter((value) => value.familyId === familyId)
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  public async update(value: ExpenseCategory): Promise<void> {
    const k = key(value.familyId, value.id);
    if (!this.#values.has(k))
      throw new RepositoryNotFoundError("expenseCategory", value.id);
    this.#values.set(k, value);
  }
}

export class InMemoryExpensePlanRepository implements ExpensePlanRepository {
  readonly #values = new Map<string, ExpensePlan>();
  public async create(value: ExpensePlan): Promise<void> {
    const k = key(value.familyId, value.id);
    if (this.#values.has(k))
      throw new RepositoryConflictError("expensePlan", value.id);
    this.#values.set(k, value);
  }
  public async getById(familyId: string, id: string): Promise<ExpensePlan> {
    const value = this.#values.get(key(familyId, id));
    if (value === undefined)
      throw new RepositoryNotFoundError("expensePlan", id);
    return value;
  }
  public async list(query: ExpensePlanQuery): Promise<readonly ExpensePlan[]> {
    return [...this.#values.values()]
      .filter((value) => value.familyId === query.familyId)
      .filter(
        (value) =>
          query.categoryId === undefined ||
          value.categoryId === query.categoryId,
      )
      .filter(
        (value) => query.active === undefined || value.active === query.active,
      )
      .filter(
        (value) =>
          query.period === undefined ||
          value.recurrence.occurrencesIn(query.period).length > 0,
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  public async update(value: ExpensePlan): Promise<void> {
    const k = key(value.familyId, value.id);
    if (!this.#values.has(k))
      throw new RepositoryNotFoundError("expensePlan", value.id);
    this.#values.set(k, value);
  }
}
