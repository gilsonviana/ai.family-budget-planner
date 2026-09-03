import { Money } from "./money.js";
import { RecurrenceRule } from "./recurrence.js";

export interface CreateExpenseCategoryInput {
  readonly active?: boolean;
  readonly familyId: string;
  readonly id: string;
  readonly name: string;
}

export interface CreateExpensePlanInput {
  readonly active?: boolean;
  readonly amount: Money;
  readonly categoryId: string;
  readonly familyId: string;
  readonly id: string;
  readonly name: string;
  readonly recurrence: RecurrenceRule;
}

export interface UpdateExpensePlanInput {
  readonly amount?: Money;
  readonly categoryId?: string;
  readonly name?: string;
  readonly recurrence?: RecurrenceRule;
}

export class InvalidExpenseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidExpenseError";
  }
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
function id(value: string, field: string): string {
  const normalized = value.trim();
  if (!ID_PATTERN.test(normalized))
    throw new InvalidExpenseError(`${field} is invalid`);
  return normalized;
}
function label(value: string, field: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (
    normalized.length === 0 ||
    normalized.length > 160 ||
    /\p{Cc}/u.test(normalized)
  ) {
    throw new InvalidExpenseError(
      `${field} must contain 1-160 visible characters`,
    );
  }
  return normalized;
}
function positive(value: Money): Money {
  if (value.minorUnits <= 0n)
    throw new InvalidExpenseError("Expense amount must be greater than zero");
  return value;
}

/** Categories are archived, never physically deleted, so plan references remain valid. */
export class ExpenseCategory {
  public readonly active: boolean;
  public readonly familyId: string;
  public readonly id: string;
  public readonly name: string;

  private constructor(input: Required<CreateExpenseCategoryInput>) {
    this.active = input.active;
    this.familyId = id(input.familyId, "Family identity");
    this.id = id(input.id, "Category identity");
    this.name = label(input.name, "Category name");
    Object.freeze(this);
  }
  public static create(input: CreateExpenseCategoryInput): ExpenseCategory {
    return new ExpenseCategory({ ...input, active: input.active ?? true });
  }
  public rename(name: string): ExpenseCategory {
    return new ExpenseCategory({ ...this, name });
  }
  public deactivate(): ExpenseCategory {
    return new ExpenseCategory({ ...this, active: false });
  }
}

export class ExpensePlan {
  public readonly active: boolean;
  public readonly amount: Money;
  public readonly categoryId: string;
  public readonly familyId: string;
  public readonly id: string;
  public readonly name: string;
  public readonly recurrence: RecurrenceRule;

  private constructor(input: Required<CreateExpensePlanInput>) {
    this.active = input.active;
    this.amount = positive(input.amount);
    this.categoryId = id(input.categoryId, "Category identity");
    this.familyId = id(input.familyId, "Family identity");
    this.id = id(input.id, "Expense plan identity");
    this.name = label(input.name, "Expense name");
    this.recurrence = input.recurrence;
    Object.freeze(this);
  }
  public static create(input: CreateExpensePlanInput): ExpensePlan {
    return new ExpensePlan({ ...input, active: input.active ?? true });
  }
  public update(input: UpdateExpensePlanInput): ExpensePlan {
    return new ExpensePlan({
      ...this,
      amount: input.amount ?? this.amount,
      categoryId: input.categoryId ?? this.categoryId,
      name: input.name ?? this.name,
      recurrence: input.recurrence ?? this.recurrence,
    });
  }
  public deactivate(): ExpensePlan {
    return new ExpensePlan({ ...this, active: false });
  }
}
