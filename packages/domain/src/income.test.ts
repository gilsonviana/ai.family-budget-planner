import { describe, expect, it } from "vitest";
import { LocalDate } from "./calendar.js";
import { IncomePlan, InvalidIncomePlanError } from "./income.js";
import { Money } from "./money.js";
import { RecurrenceRule } from "./recurrence.js";

const amount = (value: string): Money => Money.fromDecimal(value, "BRL");
const start = LocalDate.fromISO("2026-01-01");

describe("IncomePlan", () => {
  it("uses one coherent model for one-time and recurring income", () => {
    const once = IncomePlan.create({
      amount: amount("1000"),
      familyId: "family",
      id: "bonus",
      memberId: "member",
      source: "Bonus",
      recurrence: RecurrenceRule.oneTime(start),
    });
    const recurring = IncomePlan.create({
      amount: amount("5000"),
      familyId: "family",
      id: "salary",
      memberId: "member",
      source: "Salary",
      recurrence: RecurrenceRule.monthly(start, {
        endDate: LocalDate.fromISO("2026-12-01"),
      }),
    });
    expect(once.recurrence.frequency).toBe("oneTime");
    expect(recurring.recurrence.frequency).toBe("monthly");
    expect(recurring.recurrence.endDate?.toString()).toBe("2026-12-01");
  });

  it("represents inactive plans and preserves identity when updated", () => {
    const plan = IncomePlan.create({
      active: false,
      amount: amount("10"),
      familyId: "family",
      id: "income",
      memberId: "member",
      recurrence: RecurrenceRule.weekly(start),
      source: "Work",
    });
    const updated = plan
      .update({ source: "Contract work", amount: amount("20") })
      .activate();
    expect(plan.active).toBe(false);
    expect(updated.active).toBe(true);
    expect(updated.id).toBe("income");
    expect(updated.memberId).toBe("member");
    expect(updated.source).toBe("Contract work");
  });

  it.each(["0", "-1"])("rejects non-positive amount %s", (value) => {
    expect(() =>
      IncomePlan.create({
        amount: amount(value),
        familyId: "family",
        id: "income",
        memberId: "member",
        recurrence: RecurrenceRule.oneTime(start),
        source: "Source",
      }),
    ).toThrowError(InvalidIncomePlanError);
  });

  it("validates identities and source", () => {
    expect(() =>
      IncomePlan.create({
        amount: amount("1"),
        familyId: "family",
        id: "bad id",
        memberId: "member",
        recurrence: RecurrenceRule.oneTime(start),
        source: "Source",
      }),
    ).toThrowError(InvalidIncomePlanError);
    expect(() =>
      IncomePlan.create({
        amount: amount("1"),
        familyId: "family",
        id: "income",
        memberId: "member",
        recurrence: RecurrenceRule.oneTime(start),
        source: " ",
      }),
    ).toThrowError(InvalidIncomePlanError);
  });
});
