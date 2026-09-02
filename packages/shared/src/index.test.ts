import { describe, expect, it } from "vitest";

import { sharedPackageName } from "./index.js";

describe("shared package", () => {
  it("exposes its package identity", () => {
    expect(sharedPackageName).toBe("@family-finance/shared");
  });
});
