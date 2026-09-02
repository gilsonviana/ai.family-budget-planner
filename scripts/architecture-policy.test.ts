import { describe, expect, it } from "vitest";

import {
  dependencyPackageName,
  validateDependency,
} from "./architecture-policy.mjs";

describe("architecture dependency policy", () => {
  it("allows dependencies that point inward", () => {
    expect(
      validateDependency(
        "@family-finance/application",
        "@family-finance/domain",
      ),
    ).toBeNull();
    expect(
      validateDependency(
        "@family-finance/infrastructure",
        "@family-finance/application",
      ),
    ).toBeNull();
  });

  it("rejects adapter and infrastructure imports from the domain", () => {
    expect(
      validateDependency(
        "@family-finance/domain",
        "@family-finance/infrastructure",
      ),
    ).toBe(
      "@family-finance/domain cannot depend on @family-finance/infrastructure",
    );
    expect(validateDependency("@family-finance/domain", "drizzle-orm")).toBe(
      "@family-finance/domain cannot depend on external package drizzle-orm",
    );
    expect(validateDependency("@family-finance/domain", "openai")).toBe(
      "@family-finance/domain cannot depend on external package openai",
    );
    expect(validateDependency("@family-finance/domain", "resend")).toBe(
      "@family-finance/domain cannot depend on external package resend",
    );
  });

  it("rejects outward dependencies from the application", () => {
    expect(
      validateDependency(
        "@family-finance/application",
        "@family-finance/infrastructure",
      ),
    ).toBe(
      "@family-finance/application cannot depend on @family-finance/infrastructure",
    );
  });

  it("normalizes package subpath imports", () => {
    expect(dependencyPackageName("@family-finance/domain/money")).toBe(
      "@family-finance/domain",
    );
    expect(dependencyPackageName("drizzle-orm/sqlite-core")).toBe(
      "drizzle-orm",
    );
  });
});
