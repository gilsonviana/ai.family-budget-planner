import { describe, expect, it, vi } from "vitest";
import { registerInsightTools } from "./insight-tools.js";
import type { ToolRegistrar } from "./tool-boundary.js";

function handler(service?: { summarize: ReturnType<typeof vi.fn> }) {
  let result: ((input: unknown) => Promise<unknown>) | undefined;
  const server: ToolRegistrar = {
    registerTool: (_name, _definition, registered) => {
      result = registered;
    },
  };
  registerInsightTools(server, service as never);
  return result;
}

describe("AI insight MCP tool", () => {
  const input = {
    familyId: "family",
    period: { from: "2026-01-01", to: "2026-01-31" },
  };

  it("uses the deployment-injected service without caller credentials", async () => {
    const summarize = vi
      .fn()
      .mockResolvedValue({ generated: { provider: "openai" } });
    const result = await handler({ summarize })?.(input);
    expect(summarize).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      content: [{ text: expect.stringContaining("openai") }],
    });
  });

  it("returns a safe error when no provider is configured", async () => {
    const result = await handler()?.(input);
    expect(result).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining("PROVIDER_UNAVAILABLE") }],
    });
  });

  it("does not accept provider secrets in its strict caller schema", async () => {
    const summarize = vi.fn();
    const result = await handler({ summarize })?.({
      ...input,
      apiKey: "secret",
    });
    expect(summarize).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining("INVALID_ARGUMENT") }],
    });
  });
});
