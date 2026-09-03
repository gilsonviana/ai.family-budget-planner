import { describe, expect, it } from "vitest";

import { LlmProviderError, type LlmProvider } from "./llm-provider.js";

describe("LlmProvider", () => {
  it("supports provider-neutral validated structured results and usage", async () => {
    const provider: LlmProvider = {
      generateText: async () => ({
        model: "model",
        provider: "test",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        value: "text",
      }),
      generateStructured: async (_prompt, validator) => ({
        model: "model",
        provider: "test",
        usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
        value: validator.parse({ summary: "ok" }),
      }),
    };
    const result = await provider.generateStructured(
      { user: "facts" },
      { name: "Insight", parse: (value) => value as { summary: string } },
    );
    expect(result.value.summary).toBe("ok");
    expect(result.usage.totalTokens).toBe(5);
  });

  it("uses neutral provider error semantics", () => {
    expect(new LlmProviderError("rateLimit", true, "limited")).toMatchObject({
      kind: "rateLimit",
      retryable: true,
    });
  });
});
