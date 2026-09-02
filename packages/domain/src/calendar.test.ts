import { describe, expect, it } from "vitest";

import {
  DateRange,
  InvalidCalendarValueError,
  InvalidDateRangeError,
  LocalDate,
  YearMonth,
  isLeapYear,
} from "./calendar.js";

describe("LocalDate", () => {
  it("round-trips strict ISO calendar dates without a time zone", () => {
    const date = LocalDate.fromISO("2026-09-02");
    expect(date.toString()).toBe("2026-09-02");
    expect(JSON.stringify(date)).toBe('"2026-09-02"');
  });

  it.each(["2026-2-01", "2026-02-1", "2026-13-01", "2026-04-31", "text"])(
    "rejects invalid date %s",
    (value) => {
      expect(() => LocalDate.fromISO(value)).toThrowError(
        InvalidCalendarValueError,
      );
    },
  );

  it("handles leap-year rules including century boundaries", () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(() => LocalDate.of(2024, 2, 29)).not.toThrow();
    expect(() => LocalDate.of(2023, 2, 29)).toThrowError(
      InvalidCalendarValueError,
    );
  });

  it("adds days across month, year, and leap boundaries", () => {
    expect(LocalDate.fromISO("2024-02-28").addDays(1).toString()).toBe(
      "2024-02-29",
    );
    expect(LocalDate.fromISO("2024-02-29").addDays(1).toString()).toBe(
      "2024-03-01",
    );
    expect(LocalDate.fromISO("2025-01-01").addDays(-1).toString()).toBe(
      "2024-12-31",
    );
  });

  it("constrains missing month days by default", () => {
    expect(LocalDate.fromISO("2025-01-31").addMonths(1).toString()).toBe(
      "2025-02-28",
    );
    expect(LocalDate.fromISO("2024-01-31").addMonths(1).toString()).toBe(
      "2024-02-29",
    );
  });

  it("can reject a missing corresponding day", () => {
    expect(() =>
      LocalDate.fromISO("2025-01-31").addMonths(1, "reject"),
    ).toThrowError(InvalidCalendarValueError);
  });

  it("compares dates chronologically", () => {
    const earlier = LocalDate.fromISO("2025-12-31");
    const later = LocalDate.fromISO("2026-01-01");
    expect(LocalDate.compare(earlier, later)).toBe(-1);
    expect(LocalDate.compare(later, earlier)).toBe(1);
    expect(LocalDate.compare(earlier, earlier)).toBe(0);
  });
});

describe("YearMonth", () => {
  it("models month boundaries", () => {
    const month = YearMonth.fromISO("2024-02");
    expect(month.firstDay().toString()).toBe("2024-02-01");
    expect(month.lastDay().toString()).toBe("2024-02-29");
    expect(month.contains(LocalDate.fromISO("2024-02-15"))).toBe(true);
    expect(month.contains(LocalDate.fromISO("2024-03-01"))).toBe(false);
  });

  it("adds months across year boundaries", () => {
    expect(YearMonth.fromISO("2025-12").addMonths(1).toString()).toBe(
      "2026-01",
    );
    expect(YearMonth.fromISO("2025-01").addMonths(-1).toString()).toBe(
      "2024-12",
    );
  });

  it.each(["2025-1", "2025-00", "2025-13"])(
    "rejects invalid month %s",
    (value) => {
      expect(() => YearMonth.fromISO(value)).toThrowError(
        InvalidCalendarValueError,
      );
    },
  );
});

describe("DateRange", () => {
  const first = LocalDate.fromISO("2026-09-01");
  const third = LocalDate.fromISO("2026-09-03");

  it("uses documented inclusive-start and exclusive-end semantics", () => {
    const range = DateRange.halfOpen(first, third);
    expect(range.contains(first)).toBe(true);
    expect(range.contains(LocalDate.fromISO("2026-09-02"))).toBe(true);
    expect(range.contains(third)).toBe(false);
    expect(range.lengthInDays()).toBe(2);
  });

  it("converts inclusive boundaries to a half-open range", () => {
    const range = DateRange.inclusive(first, third);
    expect(range.contains(third)).toBe(true);
    expect(range.endExclusive.toString()).toBe("2026-09-04");
    expect(range.lengthInDays()).toBe(3);
  });

  it("allows an empty half-open range", () => {
    const range = DateRange.halfOpen(first, first);
    expect(range.isEmpty()).toBe(true);
    expect(range.lengthInDays()).toBe(0);
    expect(range.contains(first)).toBe(false);
  });

  it("rejects inverted ranges", () => {
    expect(() => DateRange.halfOpen(third, first)).toThrowError(
      InvalidDateRangeError,
    );
    expect(() => DateRange.inclusive(third, first)).toThrowError(
      InvalidDateRangeError,
    );
  });

  it("treats touching half-open ranges as non-overlapping", () => {
    const left = DateRange.halfOpen(first, third);
    const right = DateRange.halfOpen(third, LocalDate.fromISO("2026-09-05"));
    expect(left.overlaps(right)).toBe(false);
  });
});
