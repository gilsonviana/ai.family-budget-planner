import {
  CurrencyMismatchError,
  ExpenseCategory,
  ExpensePlan,
  type CreateExpenseCategoryInput,
  type CreateExpensePlanInput,
  type UpdateExpensePlanInput,
} from "@family-finance/domain";
import type {
  ExpenseCategoryRepository,
  ExpensePlanQuery,
  ExpensePlanRepository,
} from "../ports/expense-repositories.js";
import type { FamilyProfileRepository } from "../ports/family-repositories.js";

export interface UpdateExpensePlanCommand extends UpdateExpensePlanInput {
  readonly familyId: string;
  readonly id: string;
}

export class InactiveExpenseCategoryError extends Error {
  public constructor(id: string) {
    super(`Expense category is inactive: ${id}`);
    this.name = "InactiveExpenseCategoryError";
  }
}

export class ExpensePlanService {
  public constructor(
    private readonly families: FamilyProfileRepository,
    private readonly categories: ExpenseCategoryRepository,
    private readonly expenses: ExpensePlanRepository,
  ) {}
  public async createCategory(
    input: CreateExpenseCategoryInput,
  ): Promise<ExpenseCategory> {
    await this.families.getById(input.familyId);
    const category = ExpenseCategory.create(input);
    await this.categories.create(category);
    return category;
  }
  public async deactivateCategory(
    familyId: string,
    id: string,
  ): Promise<ExpenseCategory> {
    const category = (await this.categories.getById(familyId, id)).deactivate();
    await this.categories.update(category);
    return category;
  }
  public async create(input: CreateExpensePlanInput): Promise<ExpensePlan> {
    const family = await this.families.getById(input.familyId);
    await this.validateCategory(input.familyId, input.categoryId);
    if (family.settings.currency !== input.amount.currency)
      throw new CurrencyMismatchError(
        family.settings.currency,
        input.amount.currency,
      );
    const plan = ExpensePlan.create(input);
    await this.expenses.create(plan);
    return plan;
  }
  public get(familyId: string, id: string): Promise<ExpensePlan> {
    return this.expenses.getById(familyId, id);
  }
  public list(query: ExpensePlanQuery): Promise<readonly ExpensePlan[]> {
    return this.expenses.list(query);
  }
  public async update(command: UpdateExpensePlanCommand): Promise<ExpensePlan> {
    const plan = await this.expenses.getById(command.familyId, command.id);
    if (command.categoryId !== undefined)
      await this.validateCategory(command.familyId, command.categoryId);
    if (command.amount !== undefined) {
      const family = await this.families.getById(command.familyId);
      if (family.settings.currency !== command.amount.currency) {
        throw new CurrencyMismatchError(
          family.settings.currency,
          command.amount.currency,
        );
      }
    }
    const updated = plan.update(command);
    await this.expenses.update(updated);
    return updated;
  }
  public async deactivate(familyId: string, id: string): Promise<ExpensePlan> {
    const plan = (await this.expenses.getById(familyId, id)).deactivate();
    await this.expenses.update(plan);
    return plan;
  }
  private async validateCategory(familyId: string, id: string): Promise<void> {
    const category = await this.categories.getById(familyId, id);
    if (!category.active) throw new InactiveExpenseCategoryError(id);
  }
}
