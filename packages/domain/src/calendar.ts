export type MonthOverflow = "constrain" | "reject";

export class InvalidCalendarValueError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidCalendarValueError";
  }
}

export class InvalidDateRangeError extends InvalidCalendarValueError {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidDateRangeError";
  }
}

const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

function assertInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new InvalidCalendarValueError(`${name} must be an integer`);
  }
}

function assertYear(year: number): void {
  assertInteger(year, "Year");
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new InvalidCalendarValueError(
      `Year must be between ${MIN_YEAR} and ${MAX_YEAR}`,
    );
  }
}

function assertMonth(month: number): void {
  assertInteger(month, "Month");
  if (month < 1 || month > 12) {
    throw new InvalidCalendarValueError("Month must be between 1 and 12");
  }
}

export function isLeapYear(year: number): boolean {
  assertYear(year);
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

function floorDivide(dividend: number, divisor: number): number {
  return Math.floor(dividend / divisor);
}

// Gregorian civil-date algorithms adapted to integer arithmetic. Epoch day 0
// is 1970-01-01; no clock or time-zone conversion is involved.
function daysFromCivil(year: number, month: number, day: number): number {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = floorDivide(adjustedYear, 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = floorDivide(153 * adjustedMonth + 2, 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    floorDivide(yearOfEra, 4) -
    floorDivide(yearOfEra, 100) +
    dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function civilFromDays(epochDay: number): [number, number, number] {
  const shifted = epochDay + 719468;
  const era = floorDivide(shifted, 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = floorDivide(
    dayOfEra -
      floorDivide(dayOfEra, 1460) +
      floorDivide(dayOfEra, 36524) -
      floorDivide(dayOfEra, 146096),
    365,
  );
  let year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra + floorDivide(yearOfEra, 4) - floorDivide(yearOfEra, 100));
  const monthPrime = floorDivide(5 * dayOfYear + 2, 153);
  const day = dayOfYear - floorDivide(153 * monthPrime + 2, 5) + 1;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return [year, month, day];
}

export class LocalDate {
  public readonly day: number;
  public readonly month: number;
  public readonly year: number;

  private constructor(year: number, month: number, day: number) {
    this.year = year;
    this.month = month;
    this.day = day;
    Object.freeze(this);
  }

  public static of(year: number, month: number, day: number): LocalDate {
    assertYear(year);
    assertMonth(month);
    assertInteger(day, "Day");
    const maximumDay = daysInMonth(year, month);
    if (day < 1 || day > maximumDay) {
      throw new InvalidCalendarValueError(
        `Day must be between 1 and ${maximumDay} for ${year}-${String(month).padStart(2, "0")}`,
      );
    }
    return new LocalDate(year, month, day);
  }

  public static fromISO(value: string): LocalDate {
    const match = LOCAL_DATE_PATTERN.exec(value);
    if (!match) {
      throw new InvalidCalendarValueError(
        `LocalDate must use YYYY-MM-DD format; received ${JSON.stringify(value)}`,
      );
    }
    return LocalDate.of(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  public static compare(left: LocalDate, right: LocalDate): number {
    return Math.sign(left.toEpochDay() - right.toEpochDay());
  }

  public addDays(days: number): LocalDate {
    assertInteger(days, "Days");
    const [year, month, day] = civilFromDays(this.toEpochDay() + days);
    return LocalDate.of(year, month, day);
  }

  public addMonths(
    months: number,
    overflow: MonthOverflow = "constrain",
  ): LocalDate {
    assertInteger(months, "Months");
    const monthIndex = this.year * 12 + (this.month - 1) + months;
    const year = floorDivide(monthIndex, 12);
    const month = monthIndex - year * 12 + 1;
    assertYear(year);
    const maximumDay = daysInMonth(year, month);
    if (overflow === "reject" && this.day > maximumDay) {
      throw new InvalidCalendarValueError(
        `${this.toString()} does not have a valid corresponding day in ${year}-${String(month).padStart(2, "0")}`,
      );
    }
    return LocalDate.of(year, month, Math.min(this.day, maximumDay));
  }

  public equals(other: LocalDate): boolean {
    return (
      this.year === other.year &&
      this.month === other.month &&
      this.day === other.day
    );
  }

  public toEpochDay(): number {
    return daysFromCivil(this.year, this.month, this.day);
  }

  public toString(): string {
    return `${String(this.year).padStart(4, "0")}-${String(this.month).padStart(2, "0")}-${String(this.day).padStart(2, "0")}`;
  }

  public toJSON(): string {
    return this.toString();
  }
}

export class YearMonth {
  public readonly month: number;
  public readonly year: number;

  private constructor(year: number, month: number) {
    this.year = year;
    this.month = month;
    Object.freeze(this);
  }

  public static of(year: number, month: number): YearMonth {
    assertYear(year);
    assertMonth(month);
    return new YearMonth(year, month);
  }

  public static fromISO(value: string): YearMonth {
    const match = YEAR_MONTH_PATTERN.exec(value);
    if (!match) {
      throw new InvalidCalendarValueError(
        `YearMonth must use YYYY-MM format; received ${JSON.stringify(value)}`,
      );
    }
    return YearMonth.of(Number(match[1]), Number(match[2]));
  }

  public addMonths(months: number): YearMonth {
    assertInteger(months, "Months");
    const monthIndex = this.year * 12 + (this.month - 1) + months;
    const year = floorDivide(monthIndex, 12);
    return YearMonth.of(year, monthIndex - year * 12 + 1);
  }

  public atDay(day: number): LocalDate {
    return LocalDate.of(this.year, this.month, day);
  }

  public firstDay(): LocalDate {
    return this.atDay(1);
  }

  public lastDay(): LocalDate {
    return this.atDay(daysInMonth(this.year, this.month));
  }

  public contains(date: LocalDate): boolean {
    return this.year === date.year && this.month === date.month;
  }

  public equals(other: YearMonth): boolean {
    return this.year === other.year && this.month === other.month;
  }

  public toString(): string {
    return `${String(this.year).padStart(4, "0")}-${String(this.month).padStart(2, "0")}`;
  }

  public toJSON(): string {
    return this.toString();
  }
}

/**
 * A half-open date range: `start` is inclusive and `endExclusive` is excluded.
 * Equal boundaries represent an empty range. Use `inclusive` when both input
 * boundaries should be included.
 */
export class DateRange {
  public readonly endExclusive: LocalDate;
  public readonly start: LocalDate;

  private constructor(start: LocalDate, endExclusive: LocalDate) {
    this.start = start;
    this.endExclusive = endExclusive;
    Object.freeze(this);
  }

  public static halfOpen(start: LocalDate, endExclusive: LocalDate): DateRange {
    if (LocalDate.compare(start, endExclusive) > 0) {
      throw new InvalidDateRangeError(
        `Range start ${start} must not be after exclusive end ${endExclusive}`,
      );
    }
    return new DateRange(start, endExclusive);
  }

  public static inclusive(
    start: LocalDate,
    endInclusive: LocalDate,
  ): DateRange {
    if (LocalDate.compare(start, endInclusive) > 0) {
      throw new InvalidDateRangeError(
        `Range start ${start} must not be after inclusive end ${endInclusive}`,
      );
    }
    return new DateRange(start, endInclusive.addDays(1));
  }

  public contains(date: LocalDate): boolean {
    return (
      LocalDate.compare(this.start, date) <= 0 &&
      LocalDate.compare(date, this.endExclusive) < 0
    );
  }

  public overlaps(other: DateRange): boolean {
    return (
      LocalDate.compare(this.start, other.endExclusive) < 0 &&
      LocalDate.compare(other.start, this.endExclusive) < 0
    );
  }

  public isEmpty(): boolean {
    return this.start.equals(this.endExclusive);
  }

  public lengthInDays(): number {
    return this.endExclusive.toEpochDay() - this.start.toEpochDay();
  }
}
