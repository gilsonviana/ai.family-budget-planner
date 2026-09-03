import { describe, expect, it } from "vitest";

import { budgetInsightValidator } from "./budget-insight-schema.js";

describe("budgetInsightValidator", () => {
  it("validates generated output with the Zod schema", () => {
    expect(() =>
      budgetInsightValidator.parse({
        actions: [],
        observations: [],
        summary: "",
      }),
    ).toThrow();
    expect(
      budgetInsightValidator.parse({
        actions: ["Save"],
        observations: ["Stable"],
        summary: "On track",
      }),
    ).toEqual({
      actions: ["Save"],
      observations: ["Stable"],
      summary: "On track",
    });
  });
});
