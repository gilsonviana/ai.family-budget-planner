import { RepositoryNotFoundError } from "@family-finance/application";
import { describe, expect, it, vi } from "vitest";

import { registerPlanningTools, type ToolRegistrar } from "./planning-tools.js";

function setup(
  get = vi.fn().mockResolvedValue({ id: "family", name: "Family" }),
) {
  const handlers = new Map<string, (input: unknown) => Promise<unknown>>();
  const registrar: ToolRegistrar = {
    registerTool: (name, _definition, handler) => {
      handlers.set(name, handler);
    },
  };
  const services = {
    bills: { get: vi.fn() },
    expenses: { list: vi.fn() },
    families: { create: vi.fn(), get },
    incomes: { list: vi.fn() },
    members: { add: vi.fn(), list: vi.fn() },
  };
  registerPlanningTools(registrar, services as never);
  return { handlers, services };
}

describe("planning MCP tools", () => {
  it("registers explicit household, income, expense, and bill workflows", () => {
    expect([...setup().handlers.keys()]).toEqual([
      "family_create",
      "family_get",
      "member_add",
      "member_list",
      "income_list",
      "expense_list",
      "bill_get",
    ]);
  });

  it("validates input and calls application services", async () => {
    const { handlers, services } = setup();
    const success = await handlers.get("family_get")?.({ familyId: "family" });
    expect(services.families.get).toHaveBeenCalledWith("family");
    expect(success).not.toHaveProperty("isError");
    const invalid = await handlers.get("family_get")?.({ familyId: "" });
    expect(invalid).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining("INVALID_ARGUMENT") }],
    });
  });

  it("maps not-found errors to useful MCP responses", async () => {
    const { handlers } = setup(
      vi
        .fn()
        .mockRejectedValue(new RepositoryNotFoundError("family", "missing")),
    );
    const result = await handlers.get("family_get")?.({ familyId: "missing" });
    expect(result).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining("NOT_FOUND") }],
    });
  });
});
