import { describe, expect, it, vi } from "vitest";

import { LlmProviderError, type LlmProvider } from "../ports/llm-provider.js";
import { FallbackLlmProvider } from "./fallback-llm-provider.js";

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
function provider(
  generateStructured: LlmProvider["generateStructured"],
): LlmProvider {
  return { generateStructured, generateText: vi.fn() };
}
describe("FallbackLlmProvider", () => {
  it("falls back after unavailable or malformed output failures", async () => {
    const warning = vi.fn();
    const first = provider(
      vi
        .fn()
        .mockRejectedValue(new LlmProviderError("invalidOutput", false, "bad")),
    );
    const second = provider(
      vi.fn().mockResolvedValue({
        model: "fallback",
        provider: "second",
        usage,
        value: { summary: "safe" },
      }),
    );
    const result = await new FallbackLlmProvider(
      [
        { name: "first", provider: first },
        { name: "second", provider: second },
      ],
      { warn: warning },
    ).generateStructured(
      { user: "facts" },
      { name: "Result", parse: (value) => value },
    );
    expect(result.provider).toBe("second");
    expect(warning).toHaveBeenCalledWith({
      event: "llm_provider_failed",
      kind: "invalidOutput",
      provider: "first",
      retryable: false,
    });
  });

  it("returns an actionable, secret-free aggregate failure", async () => {
    const logs: unknown[] = [];
    const failing = provider(
      vi
        .fn()
        .mockRejectedValue(
          new LlmProviderError("authentication", false, "key sk-secret is bad"),
        ),
    );
    const operation = new FallbackLlmProvider(
      [{ name: "openai", provider: failing }],
      { warn: (event) => logs.push(event) },
    ).generateStructured(
      { user: "facts" },
      { name: "Result", parse: (value) => value },
    );
    await expect(operation).rejects.toThrow("openai (authentication)");
    expect(JSON.stringify(logs)).not.toContain("sk-secret");
  });
});
