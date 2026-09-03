import { describe, expect, it } from "vitest";

import {
  FamilyProfile,
  HouseholdSettings,
  InvalidFamilyProfileError,
  type HouseholdSettingsInput,
} from "./family.js";

const validSettings: HouseholdSettingsInput = {
  currency: "brl",
  locale: "pt-br",
  timeZone: "America/Sao_Paulo",
  weekStartsOn: 1,
};

describe("HouseholdSettings", () => {
  it("normalizes explicit financial and calendar preferences", () => {
    const settings = HouseholdSettings.create(validSettings);
    expect(settings.currency).toBe("BRL");
    expect(settings.locale).toBe("pt-BR");
    expect(settings.timeZone).toBe("America/Sao_Paulo");
    expect(settings.weekStartsOn).toBe(1);
  });

  it.each([
    [{ ...validSettings, currency: "REAL" }],
    [{ ...validSettings, locale: "not_a_locale" }],
    [{ ...validSettings, timeZone: "Sao Paulo" }],
    [{ ...validSettings, weekStartsOn: 7 }],
  ])("rejects invalid settings %#", (input) => {
    expect(() =>
      HouseholdSettings.create(input as HouseholdSettingsInput),
    ).toThrowError(InvalidFamilyProfileError);
  });
});

describe("FamilyProfile", () => {
  it("has stable identity and validated settings", () => {
    const family = FamilyProfile.create({
      id: "family_01",
      name: "  Viana   Family  ",
      settings: validSettings,
    });
    const renamed = family.rename("Viana Household");
    const updated = renamed.withSettings({
      ...validSettings,
      currency: "USD",
      locale: "en-US",
      weekStartsOn: 0,
    });

    expect(family.name).toBe("Viana Family");
    expect(renamed.id).toBe("family_01");
    expect(updated.id).toBe("family_01");
    expect(updated.name).toBe("Viana Household");
    expect(updated.settings.currency).toBe("USD");
  });

  it.each(["", "has spaces", "family/one"])(
    "rejects invalid stable identity %s",
    (id) => {
      expect(() =>
        FamilyProfile.create({ id, name: "Family", settings: validSettings }),
      ).toThrowError(InvalidFamilyProfileError);
    },
  );

  it("rejects empty, overlong, and control-character names", () => {
    expect(() =>
      FamilyProfile.create({
        id: "family",
        name: " ",
        settings: validSettings,
      }),
    ).toThrowError(InvalidFamilyProfileError);
    expect(() =>
      FamilyProfile.create({
        id: "family",
        name: "x".repeat(121),
        settings: validSettings,
      }),
    ).toThrowError(InvalidFamilyProfileError);
    expect(() =>
      FamilyProfile.create({
        id: "family",
        name: "Family\u0000Name",
        settings: validSettings,
      }),
    ).toThrowError(InvalidFamilyProfileError);
  });

  it("is immutable", () => {
    const family = FamilyProfile.create({
      id: "family",
      name: "Family",
      settings: validSettings,
    });
    expect(Object.isFrozen(family)).toBe(true);
    expect(Object.isFrozen(family.settings)).toBe(true);
  });
});
