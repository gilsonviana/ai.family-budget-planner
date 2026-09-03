import { describe, expect, it } from "vitest";

import {
  ConfigurationError,
  loadApplicationConfig,
  redactApplicationConfig,
} from "./index.js";

describe("loadApplicationConfig", () => {
  it("starts deterministic features without optional provider credentials", () => {
    expect(loadApplicationConfig({})).toEqual({
      database: { path: "./finance.db" },
      logging: { level: "info" },
    });
  });

  it("loads fully configured providers", () => {
    expect(
      loadApplicationConfig({
        FINANCE_DATABASE_PATH: "/data/family.sqlite",
        FINANCE_LOG_LEVEL: "debug",
        FINANCE_LLM_PROVIDER: "openai",
        FINANCE_LLM_MODEL: "example-model",
        FINANCE_LLM_API_KEY: "llm-secret",
        FINANCE_EMAIL_PROVIDER: "resend",
        FINANCE_EMAIL_FROM: "budget@example.com",
        FINANCE_EMAIL_API_KEY: "email-secret",
      }),
    ).toMatchObject({
      database: { path: "/data/family.sqlite" },
      logging: { level: "debug" },
      llm: { provider: "openai", model: "example-model", apiKey: "llm-secret" },
      email: {
        provider: "resend",
        from: "budget@example.com",
        apiKey: "email-secret",
      },
    });
  });

  it("reports actionable field names for incomplete provider configuration", () => {
    expect(() =>
      loadApplicationConfig({ FINANCE_LLM_PROVIDER: "openai" }),
    ).toThrow(
      new ConfigurationError([
        "FINANCE_LLM_MODEL: is required when FINANCE_LLM_PROVIDER is configured",
        "FINANCE_LLM_API_KEY: is required when FINANCE_LLM_PROVIDER is configured",
      ]),
    );
  });

  it("redacts provider secrets from loggable configuration", () => {
    const config = loadApplicationConfig({
      FINANCE_LLM_PROVIDER: "openai",
      FINANCE_LLM_MODEL: "example-model",
      FINANCE_LLM_API_KEY: "llm-secret",
      FINANCE_EMAIL_PROVIDER: "resend",
      FINANCE_EMAIL_FROM: "budget@example.com",
      FINANCE_EMAIL_API_KEY: "email-secret",
    });

    const serialized = JSON.stringify(redactApplicationConfig(config));
    expect(serialized).not.toContain("llm-secret");
    expect(serialized).not.toContain("email-secret");
    expect(serialized.match(/\[REDACTED\]/g)).toHaveLength(2);
  });
});
