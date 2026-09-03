import {
  FamilyProfile,
  type HouseholdSettingsInput,
} from "@family-finance/domain";
import { describe, expect, it } from "vitest";
import {
  RepositoryConflictError,
  RepositoryNotFoundError,
} from "../ports/family-repositories.js";
import {
  InMemoryFamilyMemberRepository,
  InMemoryFamilyProfileRepository,
} from "../testing/in-memory-family-repositories.js";
import {
  CannotRemoveReferencedMemberError,
  FamilyMemberService,
  type MemberReferenceChecker,
} from "./family-members.js";

const settings: HouseholdSettingsInput = {
  currency: "BRL",
  locale: "pt-BR",
  timeZone: "America/Sao_Paulo",
  weekStartsOn: 1,
};

async function setup(referenced = false): Promise<FamilyMemberService> {
  const families = new InMemoryFamilyProfileRepository();
  await families.create(
    FamilyProfile.create({ id: "family", name: "Family", settings }),
  );
  const references: MemberReferenceChecker = {
    hasReferences: async () => referenced,
  };
  return new FamilyMemberService(
    families,
    new InMemoryFamilyMemberRepository(),
    references,
  );
}

describe("FamilyMemberService", () => {
  it("adds, edits, lists, and removes members", async () => {
    const service = await setup();
    await service.add({ familyId: "family", id: "two", name: "Second" });
    await service.add({ familyId: "family", id: "one", name: "First" });
    expect((await service.edit("family", "one", "Updated")).name).toBe(
      "Updated",
    );
    expect((await service.list("family")).map(({ id }) => id)).toEqual([
      "one",
      "two",
    ]);
    await service.remove("family", "one");
    expect((await service.list("family")).map(({ id }) => id)).toEqual(["two"]);
  });

  it("rejects missing families, duplicates, and missing members", async () => {
    const service = await setup();
    await expect(
      service.add({ familyId: "missing", id: "one", name: "One" }),
    ).rejects.toBeInstanceOf(RepositoryNotFoundError);
    await service.add({ familyId: "family", id: "one", name: "One" });
    await expect(
      service.add({ familyId: "family", id: "one", name: "Duplicate" }),
    ).rejects.toBeInstanceOf(RepositoryConflictError);
    await expect(
      service.edit("family", "missing", "Name"),
    ).rejects.toBeInstanceOf(RepositoryNotFoundError);
  });

  it("prohibits removing a member referenced by plans", async () => {
    const service = await setup(true);
    await service.add({ familyId: "family", id: "one", name: "One" });
    await expect(service.remove("family", "one")).rejects.toBeInstanceOf(
      CannotRemoveReferencedMemberError,
    );
    expect(await service.list("family")).toHaveLength(1);
  });
});
