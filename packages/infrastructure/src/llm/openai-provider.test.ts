import { describe, expect, it, vi } from "vitest";

import { OpenAILlmProvider } from "./openai-provider.js";

const configured = {
  database: { path: "db" },
  logging: { level: "info" as const },
  llm: { provider: "openai", model: "configured-model", apiKey: "secret" },
};
const response = {
  model: "configured-model",
  outputText: '{"summary":"ok"}',
  usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
};
describe("OpenAILlmProvider", () => {
  it("uses configured credentials/model and validates structured output", async () => {
    const create = vi.fn().mockResolvedValue(response);
    const result = await new OpenAILlmProvider(configured, {
      create,
    }).generateStructured(
      { user: "facts" },
      {
        jsonSchema: { type: "object" },
        name: "Result",
        parse: (value) => value as { summary: string },
      },
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "secret",
        model: "configured-model",
        schema: { name: "Result", value: { type: "object" } },
      }),
    );
    expect(result).toMatchObject({
      provider: "openai",
      usage: { totalTokens: 5 },
      value: { summary: "ok" },
    });
  });

  it("limits missing credentials to adapter construction", () => {
    expect(
      () =>
        new OpenAILlmProvider({
          database: { path: "db" },
          logging: { level: "info" },
        }),
    ).toThrow("OpenAI features are not configured");
  });

  it("rejects malformed structured responses neutrally", async () => {
    const provider = new OpenAILlmProvider(configured, {
      create: vi
        .fn()
        .mockResolvedValue({ ...response, outputText: "not json" }),
    });
    await expect(
      provider.generateStructured(
        { user: "facts" },
        { name: "Result", parse: (value) => value },
      ),
    ).rejects.toMatchObject({ kind: "invalidOutput" });
  });
});
