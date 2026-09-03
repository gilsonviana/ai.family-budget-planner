import {
  DateRange,
  FamilyMember,
  FamilyProfile,
  LocalDate,
  Money,
  RecurrenceRule,
  type HouseholdSettingsInput,
} from "@family-finance/domain";
import { describe, expect, it } from "vitest";
import { RepositoryNotFoundError } from "../ports/family-repositories.js";
import {
  InMemoryFamilyMemberRepository,
  InMemoryFamilyProfileRepository,
} from "../testing/in-memory-family-repositories.js";
import { InMemoryIncomePlanRepository } from "../testing/in-memory-income-repository.js";
import { IncomePlanService } from "./income-plans.js";

const settings: HouseholdSettingsInput = {
  currency: "BRL",
  locale: "pt-BR",
  timeZone: "America/Sao_Paulo",
  weekStartsOn: 1,
};

async function setup(): Promise<IncomePlanService> {
  const families = new InMemoryFamilyProfileRepository();
  const members = new InMemoryFamilyMemberRepository();
  await families.create(
    FamilyProfile.create({ id: "family", name: "Family", settings }),
  );
  await members.create(
    FamilyMember.create({ familyId: "family", id: "member", name: "Member" }),
  );
  return new IncomePlanService(
    families,
    members,
    new InMemoryIncomePlanRepository(),
  );
}

const command = () => ({
  amount: Money.fromDecimal("5000", "BRL"),
  familyId: "family",
  id: "salary",
  memberId: "member",
  recurrence: RecurrenceRule.monthly(LocalDate.fromISO("2026-01-01")),
  source: "Salary",
});

describe("IncomePlanService", () => {
  it("creates, retrieves, updates, and deactivates income plans", async () => {
    const service = await setup();
    await service.create(command());
    expect((await service.get("family", "salary")).source).toBe("Salary");
    expect(
      (
        await service.update({
          familyId: "family",
          id: "salary",
          source: "Main salary",
        })
      ).source,
    ).toBe("Main salary");
    expect((await service.deactivate("family", "salary")).active).toBe(false);
  });

  it("filters plans by member and active period", async () => {
    const service = await setup();
    await service.create(command());
    const period = DateRange.halfOpen(
      LocalDate.fromISO("2026-02-01"),
      LocalDate.fromISO("2026-03-01"),
    );
    expect(
      await service.list({
        familyId: "family",
        memberId: "member",
        active: true,
        period,
      }),
    ).toHaveLength(1);
  });

  it("rejects a missing referenced member", async () => {
    const service = await setup();
    await expect(
      service.create({ ...command(), memberId: "missing" }),
    ).rejects.toBeInstanceOf(RepositoryNotFoundError);
  });

  it("reports member references for removal policy", async () => {
    const service = await setup();
    expect(await service.hasMemberReferences("family", "member")).toBe(false);
    await service.create(command());
    expect(await service.hasMemberReferences("family", "member")).toBe(true);
  });
});
