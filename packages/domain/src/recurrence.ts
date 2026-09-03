import { DateRange, LocalDate, type MonthOverflow } from "./calendar.js";

export type RecurrenceFrequency =
  "oneTime" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurrenceInput {
  readonly endDate?: LocalDate;
  readonly frequency: string;
  readonly monthOverflow?: MonthOverflow;
  readonly startDate: LocalDate;
}

export class InvalidRecurrenceRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidRecurrenceRuleError";
  }
}

const SUPPORTED_FREQUENCIES = new Set<RecurrenceFrequency>([
  "oneTime",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);

function isSupportedFrequency(value: string): value is RecurrenceFrequency {
  return SUPPORTED_FREQUENCIES.has(value as RecurrenceFrequency);
}

/**
 * A deliberately constrained recurrence anchored to its original start date.
 * Month-based occurrences never drift: a January 31 monthly rule constrains to
 * February's end and returns to March 31 on the following occurrence.
 */
export class RecurrenceRule {
  public readonly endDate: LocalDate | undefined;
  public readonly frequency: RecurrenceFrequency;
  public readonly monthOverflow: MonthOverflow;
  public readonly startDate: LocalDate;

  private constructor(
    frequency: RecurrenceFrequency,
    startDate: LocalDate,
    endDate: LocalDate | undefined,
    monthOverflow: MonthOverflow,
  ) {
    this.frequency = frequency;
    this.startDate = startDate;
    this.endDate = endDate;
    this.monthOverflow = monthOverflow;
    Object.freeze(this);
  }

  public static create(input: RecurrenceInput): RecurrenceRule {
    if (!isSupportedFrequency(input.frequency)) {
      throw new InvalidRecurrenceRuleError(
        `Unsupported recurrence frequency: ${input.frequency}`,
      );
    }
    if (
      input.endDate !== undefined &&
      LocalDate.compare(input.endDate, input.startDate) < 0
    ) {
      throw new InvalidRecurrenceRuleError(
        "Recurrence end date must not be before its start date",
      );
    }
    if (
      input.monthOverflow !== undefined &&
      input.monthOverflow !== "constrain" &&
      input.monthOverflow !== "reject"
    ) {
      throw new InvalidRecurrenceRuleError(
        `Unsupported month overflow behavior: ${String(input.monthOverflow)}`,
      );
    }
    if (input.frequency === "oneTime" && input.endDate !== undefined) {
      throw new InvalidRecurrenceRuleError(
        "A one-time recurrence cannot declare an end date",
      );
    }
    return new RecurrenceRule(
      input.frequency,
      input.startDate,
      input.endDate,
      input.monthOverflow ?? "constrain",
    );
  }

  public static oneTime(date: LocalDate): RecurrenceRule {
    return RecurrenceRule.create({ frequency: "oneTime", startDate: date });
  }

  public static weekly(
    startDate: LocalDate,
    endDate?: LocalDate,
  ): RecurrenceRule {
    return RecurrenceRule.create({
      ...(endDate === undefined ? {} : { endDate }),
      frequency: "weekly",
      startDate,
    });
  }

  public static monthly(
    startDate: LocalDate,
    options: {
      readonly endDate?: LocalDate;
      readonly overflow?: MonthOverflow;
    } = {},
  ): RecurrenceRule {
    return RecurrenceRule.monthBased("monthly", startDate, options);
  }

  public static quarterly(
    startDate: LocalDate,
    options: {
      readonly endDate?: LocalDate;
      readonly overflow?: MonthOverflow;
    } = {},
  ): RecurrenceRule {
    return RecurrenceRule.monthBased("quarterly", startDate, options);
  }

  public static yearly(
    startDate: LocalDate,
    options: {
      readonly endDate?: LocalDate;
      readonly overflow?: MonthOverflow;
    } = {},
  ): RecurrenceRule {
    return RecurrenceRule.monthBased("yearly", startDate, options);
  }

  private static monthBased(
    frequency: "monthly" | "quarterly" | "yearly",
    startDate: LocalDate,
    options: {
      readonly endDate?: LocalDate;
      readonly overflow?: MonthOverflow;
    },
  ): RecurrenceRule {
    return RecurrenceRule.create({
      ...(options.endDate === undefined ? {} : { endDate: options.endDate }),
      ...(options.overflow === undefined
        ? {}
        : { monthOverflow: options.overflow }),
      frequency,
      startDate,
    });
  }

  /** Returns occurrences inside the half-open query range. */
  public occurrencesIn(range: DateRange): readonly LocalDate[] {
    if (this.frequency === "oneTime") {
      return range.contains(this.startDate) ? [this.startDate] : [];
    }

    const occurrences: LocalDate[] = [];
    for (let index = 0; ; index += 1) {
      const occurrence = this.occurrenceAt(index);

      if (
        this.endDate !== undefined &&
        LocalDate.compare(occurrence, this.endDate) > 0
      ) {
        break;
      }
      if (LocalDate.compare(occurrence, range.endExclusive) >= 0) {
        break;
      }
      if (range.contains(occurrence)) {
        occurrences.push(occurrence);
      }
    }
    return occurrences;
  }

  private occurrenceAt(index: number): LocalDate {
    switch (this.frequency) {
      case "weekly":
        return this.startDate.addDays(index * 7);
      case "monthly":
        return this.startDate.addMonths(index, this.monthOverflow);
      case "quarterly":
        return this.startDate.addMonths(index * 3, this.monthOverflow);
      case "yearly":
        return this.startDate.addMonths(index * 12, this.monthOverflow);
      case "oneTime":
        return this.startDate;
    }
  }
}
