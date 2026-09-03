import { describe, expect, it } from "vitest";

import { DateRange, LocalDate } from "./calendar.js";
import { InvalidRecurrenceRuleError, RecurrenceRule } from "./recurrence.js";

const date = (value: string): LocalDate => LocalDate.fromISO(value);
const range = (start: string, endExclusive: string): DateRange =>
  DateRange.halfOpen(date(start), date(endExclusive));
const iso = (dates: readonly LocalDate[]): string[] =>
  dates.map((value) => value.toString());

describe("RecurrenceRule", () => {
  it("generates a one-time occurrence only when it is in range", () => {
    const rule = RecurrenceRule.oneTime(date("2026-09-15"));
    expect(iso(rule.occurrencesIn(range("2026-09-01", "2026-10-01")))).toEqual([
      "2026-09-15",
    ]);
    expect(rule.occurrencesIn(range("2026-10-01", "2026-11-01"))).toEqual([]);
  });

  it("generates weekly occurrences at half-open boundaries", () => {
    const rule = RecurrenceRule.weekly(date("2026-09-01"));
    expect(iso(rule.occurrencesIn(range("2026-09-08", "2026-09-22")))).toEqual([
      "2026-09-08",
      "2026-09-15",
    ]);
  });

  it("generates monthly occurrences without end-of-month drift", () => {
    const rule = RecurrenceRule.monthly(date("2025-01-31"));
    expect(iso(rule.occurrencesIn(range("2025-01-01", "2025-05-01")))).toEqual([
      "2025-01-31",
      "2025-02-28",
      "2025-03-31",
      "2025-04-30",
    ]);
  });

  it("generates quarterly occurrences from the original anchor", () => {
    const rule = RecurrenceRule.quarterly(date("2025-11-30"));
    expect(iso(rule.occurrencesIn(range("2025-01-01", "2027-01-01")))).toEqual([
      "2025-11-30",
      "2026-02-28",
      "2026-05-30",
      "2026-08-30",
      "2026-11-30",
    ]);
  });

  it("handles leap-day yearly recurrence deterministically", () => {
    const rule = RecurrenceRule.yearly(date("2024-02-29"));
    expect(iso(rule.occurrencesIn(range("2024-01-01", "2029-01-01")))).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
  });

  it("honors an inclusive recurrence end date", () => {
    const rule = RecurrenceRule.weekly(date("2026-09-01"), date("2026-09-15"));
    expect(iso(rule.occurrencesIn(range("2026-01-01", "2027-01-01")))).toEqual([
      "2026-09-01",
      "2026-09-08",
      "2026-09-15",
    ]);
  });

  it("rejects invalid and unsupported rules", () => {
    expect(() =>
      RecurrenceRule.create({
        frequency: "daily",
        startDate: date("2026-09-01"),
      }),
    ).toThrowError(InvalidRecurrenceRuleError);
    expect(() =>
      RecurrenceRule.weekly(date("2026-09-02"), date("2026-09-01")),
    ).toThrowError(InvalidRecurrenceRuleError);
    expect(() =>
      RecurrenceRule.create({
        endDate: date("2026-09-02"),
        frequency: "oneTime",
        startDate: date("2026-09-01"),
      }),
    ).toThrowError(InvalidRecurrenceRuleError);
  });

  it("supports explicit rejection of missing month days", () => {
    const rule = RecurrenceRule.monthly(date("2025-01-31"), {
      overflow: "reject",
    });
    expect(() =>
      rule.occurrencesIn(range("2025-01-01", "2025-03-01")),
    ).toThrowError();
  });
});
