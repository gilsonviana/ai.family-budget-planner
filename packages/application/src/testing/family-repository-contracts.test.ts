import {
  FamilyMember,
  FamilyProfile,
  type HouseholdSettingsInput,
} from "@family-finance/domain";
import { describe, expect, it } from "vitest";

import {
  RepositoryConflictError,
  RepositoryNotFoundError,
  type FamilyMemberRepository,
  type FamilyProfileRepository,
} from "../ports/family-repositories.js";
import {
  InMemoryFamilyMemberRepository,
  InMemoryFamilyProfileRepository,
} from "./in-memory-family-repositories.js";

const settings: HouseholdSettingsInput = {
  currency: "BRL",
  locale: "pt-BR",
  timeZone: "America/Sao_Paulo",
  weekStartsOn: 1,
};

function family(id = "family"): FamilyProfile {
  return FamilyProfile.create({ id, name: "Family", settings });
}

function familyProfileRepositoryContract(
  createRepository: () => FamilyProfileRepository,
): void {
  it("creates, finds, gets, and updates profiles", async () => {
    const repository = createRepository();
    const original = family();
    await repository.create(original);
    expect(await repository.findById(original.id)).toBe(original);
    expect(await repository.getById(original.id)).toBe(original);

    const updated = original.rename("Updated Family");
    await repository.update(updated);
    expect((await repository.getById(original.id)).name).toBe("Updated Family");
  });

  it("uses typed conflict and not-found semantics", async () => {
    const repository = createRepository();
    await expect(repository.getById("missing")).rejects.toBeInstanceOf(
      RepositoryNotFoundError,
    );
    await expect(repository.update(family("missing"))).rejects.toBeInstanceOf(
      RepositoryNotFoundError,
    );
    await repository.create(family());
    await expect(repository.create(family())).rejects.toBeInstanceOf(
      RepositoryConflictError,
    );
  });
}

function member(id: string, familyId = "family", name = id): FamilyMember {
  return FamilyMember.create({ familyId, id, name });
}

function familyMemberRepositoryContract(
  createRepository: () => FamilyMemberRepository,
): void {
  it("creates, finds, lists, updates, and removes scoped members", async () => {
    const repository = createRepository();
    await repository.create(member("b"));
    await repository.create(member("a"));
    await repository.create(member("a", "other-family"));

    expect(
      (await repository.listByFamilyId("family")).map(({ id }) => id),
    ).toEqual(["a", "b"]);
    expect(await repository.findById("family", "a")).toEqual(member("a"));
    expect(await repository.findById("other-family", "b")).toBeNull();

    await repository.update(member("a", "family", "Updated"));
    expect((await repository.getById("family", "a")).name).toBe("Updated");
    await repository.remove("family", "a");
    expect(await repository.findById("family", "a")).toBeNull();
  });

  it("uses typed conflict and not-found semantics", async () => {
    const repository = createRepository();
    await expect(
      repository.getById("family", "missing"),
    ).rejects.toBeInstanceOf(RepositoryNotFoundError);
    await expect(repository.update(member("missing"))).rejects.toBeInstanceOf(
      RepositoryNotFoundError,
    );
    await expect(repository.remove("family", "missing")).rejects.toBeInstanceOf(
      RepositoryNotFoundError,
    );
    await repository.create(member("one"));
    await expect(repository.create(member("one"))).rejects.toBeInstanceOf(
      RepositoryConflictError,
    );
  });
}

describe("InMemoryFamilyProfileRepository contract", () => {
  familyProfileRepositoryContract(() => new InMemoryFamilyProfileRepository());
});

describe("InMemoryFamilyMemberRepository contract", () => {
  familyMemberRepositoryContract(() => new InMemoryFamilyMemberRepository());
});
