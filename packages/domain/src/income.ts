import { Money } from "./money.js";
import { RecurrenceRule } from "./recurrence.js";

export interface CreateIncomePlanInput {
  readonly active?: boolean;
  readonly amount: Money;
  readonly familyId: string;
  readonly id: string;
  readonly memberId: string;
  readonly recurrence: RecurrenceRule;
  readonly source: string;
}

export interface UpdateIncomePlanInput {
  readonly amount?: Money;
  readonly recurrence?: RecurrenceRule;
  readonly source?: string;
}

export class InvalidIncomePlanError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidIncomePlanError";
  }
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function id(value: string, field: string): string {
  const normalized = value.trim();
  if (!ID_PATTERN.test(normalized)) {
    throw new InvalidIncomePlanError(`${field} is invalid`);
  }
  return normalized;
}

function source(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (
    normalized.length === 0 ||
    normalized.length > 160 ||
    /\p{Cc}/u.test(normalized)
  ) {
    throw new InvalidIncomePlanError(
      "Income source must contain 1-160 visible characters",
    );
  }
  return normalized;
}

function amount(value: Money): Money {
  if (value.minorUnits <= 0n) {
    throw new InvalidIncomePlanError(
      "Expected income amount must be greater than zero",
    );
  }
  return value;
}

export class IncomePlan {
  public readonly active: boolean;
  public readonly amount: Money;
  public readonly familyId: string;
  public readonly id: string;
  public readonly memberId: string;
  public readonly recurrence: RecurrenceRule;
  public readonly source: string;

  private constructor(input: Required<CreateIncomePlanInput>) {
    this.id = id(input.id, "Income plan identity");
    this.familyId = id(input.familyId, "Family identity");
    this.memberId = id(input.memberId, "Member identity");
    this.source = source(input.source);
    this.amount = amount(input.amount);
    this.recurrence = input.recurrence;
    this.active = input.active;
    Object.freeze(this);
  }

  public static create(input: CreateIncomePlanInput): IncomePlan {
    return new IncomePlan({ ...input, active: input.active ?? true });
  }

  public update(input: UpdateIncomePlanInput): IncomePlan {
    return new IncomePlan({
      active: this.active,
      amount: input.amount ?? this.amount,
      familyId: this.familyId,
      id: this.id,
      memberId: this.memberId,
      recurrence: input.recurrence ?? this.recurrence,
      source: input.source ?? this.source,
    });
  }

  public activate(): IncomePlan {
    return new IncomePlan({ ...this, active: true });
  }

  public deactivate(): IncomePlan {
    return new IncomePlan({ ...this, active: false });
  }
}
