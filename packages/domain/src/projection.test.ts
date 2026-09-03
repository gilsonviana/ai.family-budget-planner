import { describe, expect, it } from "vitest";

import { DateRange, LocalDate } from "./calendar.js";
import {
  CurrencyMismatchError,
  Money,
  MoneyScaleMismatchError,
} from "./money.js";
import {
  DuplicateProjectionPlanError,
  InvalidProjectionPlanError,
  ProjectionEngine,
  type FinancialPlan,
} from "./projection.js";
import { RecurrenceRule } from "./recurrence.js";

const date = (value: string): LocalDate => LocalDate.fromISO(value);
const period = (start: string, endExclusive: string): DateRange =>
  DateRange.halfOpen(date(start), date(endExclusive));
const money = (amount: string): Money => Money.fromDecimal(amount, "BRL");

describe("ProjectionEngine", () => {
  const engine = new ProjectionEngine();

  it("projects representative recurrence combinations into ordered occurrences", () => {
    const plans: FinancialPlan[] = [
      {
        amount: money("100.00"),
        id: "monthly",
        recurrence: RecurrenceRule.monthly(date("2026-01-31")),
      },
      {
        amount: money("20.00"),
        id: "weekly",
        recurrence: RecurrenceRule.weekly(date("2026-02-01")),
      },
      {
        amount: money("300.00"),
        id: "quarterly",
        recurrence: RecurrenceRule.quarterly(date("2025-11-30")),
      },
      {
        amount: money("1200.00"),
        id: "yearly",
        recurrence: RecurrenceRule.yearly(date("2024-02-29")),
      },
      {
        amount: money("50.00"),
        id: "once",
        recurrence: RecurrenceRule.oneTime(date("2026-02-10")),
      },
    ];

    const result = engine.project({
      currency: "BRL",
      period: period("2026-02-01", "2026-03-01"),
      plans,
    });

    expect(
      result.occurrences.map(({ date: occurrenceDate, planId }) => [
        occurrenceDate.toString(),
        planId,
      ]),
    ).toEqual([
      ["2026-02-01", "weekly"],
      ["2026-02-08", "weekly"],
      ["2026-02-10", "once"],
      ["2026-02-15", "weekly"],
      ["2026-02-22", "weekly"],
      ["2026-02-28", "monthly"],
      ["2026-02-28", "quarterly"],
      ["2026-02-28", "yearly"],
    ]);
    expect(result.total.toDecimal()).toBe("1730.00");
  });

  it("does not duplicate occurrences across adjacent period boundaries", () => {
    const plan: FinancialPlan = {
      amount: money("10.00"),
      id: "weekly",
      recurrence: RecurrenceRule.weekly(date("2026-09-01")),
    };
    const left = engine.project({
      currency: "BRL",
      period: period("2026-09-01", "2026-09-08"),
      plans: [plan],
    });
    const right = engine.project({
      currency: "BRL",
      period: period("2026-09-08", "2026-09-15"),
      plans: [plan],
    });

    expect(left.occurrences.map(({ date: value }) => value.toString())).toEqual(
      ["2026-09-01"],
    );
    expect(
      right.occurrences.map(({ date: value }) => value.toString()),
    ).toEqual(["2026-09-08"]);
  });

  it("accepts arbitrary and empty date ranges", () => {
    const result = engine.project({
      currency: "BRL",
      period: period("2026-09-02", "2026-09-02"),
      plans: [],
    });
    expect(result.occurrences).toEqual([]);
    expect(result.total.toDecimal()).toBe("0.00");
  });

  it("validates plan currency and scale even when no occurrence is in range", () => {
    const recurrence = RecurrenceRule.oneTime(date("2030-01-01"));
    expect(() =>
      engine.project({
        currency: "BRL",
        period: period("2026-01-01", "2027-01-01"),
        plans: [
          { amount: Money.fromDecimal("1.00", "USD"), id: "usd", recurrence },
        ],
      }),
    ).toThrowError(CurrencyMismatchError);
    expect(() =>
      engine.project({
        currency: "BRL",
        fractionDigits: 2,
        period: period("2026-01-01", "2027-01-01"),
        plans: [
          {
            amount: Money.fromDecimal("1.000", "BRL", { fractionDigits: 3 }),
            id: "mills",
            recurrence,
          },
        ],
      }),
    ).toThrowError(MoneyScaleMismatchError);
  });

  it("rejects empty and duplicate plan identifiers", () => {
    const recurrence = RecurrenceRule.oneTime(date("2026-01-01"));
    expect(() =>
      engine.project({
        currency: "BRL",
        period: period("2026-01-01", "2027-01-01"),
        plans: [{ amount: money("1.00"), id: " ", recurrence }],
      }),
    ).toThrowError(InvalidProjectionPlanError);
    expect(() =>
      engine.project({
        currency: "BRL",
        period: period("2026-01-01", "2027-01-01"),
        plans: [
          { amount: money("1.00"), id: "same", recurrence },
          { amount: money("2.00"), id: "same", recurrence },
        ],
      }),
    ).toThrowError(DuplicateProjectionPlanError);
  });
});
