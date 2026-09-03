import type { HouseholdSettingsInput } from "@family-finance/domain";
import { describe, expect, it } from "vitest";

import {
  RepositoryConflictError,
  RepositoryNotFoundError,
} from "../ports/family-repositories.js";
import { InMemoryFamilyProfileRepository } from "../testing/in-memory-family-repositories.js";
import {
  FamilyProfileService,
  InvalidFamilyProfileCommandError,
} from "./family-profile.js";

const settings: HouseholdSettingsInput = {
  currency: "BRL",
  locale: "pt-BR",
  timeZone: "America/Sao_Paulo",
  weekStartsOn: 1,
};

describe("FamilyProfileService", () => {
  it("creates and retrieves a family through its repository port", async () => {
    const service = new FamilyProfileService(
      new InMemoryFamilyProfileRepository(),
    );
    const created = await service.create({
      id: "family",
      name: "Viana Family",
      settings,
    });
    expect(await service.get("family")).toBe(created);
  });

  it("updates name and settings while preserving identity", async () => {
    const service = new FamilyProfileService(
      new InMemoryFamilyProfileRepository(),
    );
    await service.create({ id: "family", name: "Family", settings });
    const updated = await service.update({
      id: "family",
      name: "Updated Family",
      settings: { ...settings, currency: "USD" },
    });
    expect(updated.id).toBe("family");
    expect(updated.name).toBe("Updated Family");
    expect(updated.settings.currency).toBe("USD");
  });

  it("surfaces typed duplicate and missing-family behavior", async () => {
    const service = new FamilyProfileService(
      new InMemoryFamilyProfileRepository(),
    );
    await service.create({ id: "family", name: "Family", settings });
    await expect(
      service.create({ id: "family", name: "Duplicate", settings }),
    ).rejects.toBeInstanceOf(RepositoryConflictError);
    await expect(service.get("missing")).rejects.toBeInstanceOf(
      RepositoryNotFoundError,
    );
    await expect(
      service.update({ id: "missing", name: "Missing" }),
    ).rejects.toBeInstanceOf(RepositoryNotFoundError);
  });

  it("rejects an empty update command", async () => {
    const service = new FamilyProfileService(
      new InMemoryFamilyProfileRepository(),
    );
    await expect(service.update({ id: "family" })).rejects.toBeInstanceOf(
      InvalidFamilyProfileCommandError,
    );
  });
});
