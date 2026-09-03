import {
  DateRange,
  IncomePlan,
  LocalDate,
  Money,
  RecurrenceRule,
} from "@family-finance/domain";
import { describe, expect, it } from "vitest";
import {
  RepositoryConflictError,
  RepositoryNotFoundError,
} from "../ports/family-repositories.js";
import type { IncomePlanRepository } from "../ports/income-repository.js";
import { InMemoryIncomePlanRepository } from "./in-memory-income-repository.js";

const date = (value: string): LocalDate => LocalDate.fromISO(value);
function plan(id: string, memberId = "member"): IncomePlan {
  return IncomePlan.create({
    amount: Money.fromDecimal("100", "BRL"),
    familyId: "family",
    id,
    memberId,
    recurrence: RecurrenceRule.monthly(date("2026-01-01")),
    source: id,
  });
}

function contract(createRepository: () => IncomePlanRepository): void {
  it("supports lifecycle operations with typed failures", async () => {
    const repository = createRepository();
    const original = plan("salary");
    await repository.create(original);
    expect(await repository.getById("family", "salary")).toBe(original);
    const updated = original.update({ source: "Updated" });
    await repository.update(updated);
    expect((await repository.getById("family", "salary")).source).toBe(
      "Updated",
    );
    await expect(repository.create(original)).rejects.toBeInstanceOf(
      RepositoryConflictError,
    );
    await expect(
      repository.getById("family", "missing"),
    ).rejects.toBeInstanceOf(RepositoryNotFoundError);
  });

  it("filters by family, member, active state, and period", async () => {
    const repository = createRepository();
    await repository.create(plan("b", "member-2"));
    await repository.create(plan("a"));
    await repository.create(plan("inactive").deactivate());
    await repository.create(
      IncomePlan.create({
        amount: Money.fromDecimal("10", "BRL"),
        familyId: "family",
        id: "future",
        memberId: "member",
        recurrence: RecurrenceRule.oneTime(date("2030-01-01")),
        source: "Future",
      }),
    );
    const period = DateRange.halfOpen(date("2026-01-01"), date("2026-02-01"));
    expect(
      (
        await repository.list({
          familyId: "family",
          memberId: "member",
          active: true,
          period,
        })
      ).map(({ id }) => id),
    ).toEqual(["a"]);
  });
}

describe("InMemoryIncomePlanRepository contract", () => {
  contract(() => new InMemoryIncomePlanRepository());
});
