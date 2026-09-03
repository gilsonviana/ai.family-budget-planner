import { RepositoryNotFoundError } from "@family-finance/application";
import { describe, expect, it } from "vitest";

import { ExitCode, runCli } from "./index.js";

function io(environment: Record<string, string | undefined> = {}) {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    errors,
    output,
    value: {
      environment,
      error: (value: string) => errors.push(value),
      log: (value: string) => output.push(value),
    },
  };
}

describe("finance CLI shell", () => {
  it.each([["--help"], ["-h"], ["help"]])(
    "prints help for %s",
    async (argument) => {
      const streams = io();
      expect(await runCli([argument], streams.value)).toBe(ExitCode.success);
      expect(streams.output[0]).toContain("Usage: finance");
    },
  );

  it("prints its version", async () => {
    const streams = io();
    expect(await runCli(["--version"], streams.value)).toBe(ExitCode.success);
    expect(streams.output).toEqual(["0.0.0"]);
  });

  it("distinguishes validation, not-found, and system failures", async () => {
    const validation = io();
    expect(await runCli(["unknown"], validation.value)).toBe(
      ExitCode.validation,
    );
    const missing = io();
    expect(
      await runCli(["show"], missing.value, async () => {
        throw new RepositoryNotFoundError("family", "missing");
      }),
    ).toBe(ExitCode.notFound);
    const system = io();
    expect(
      await runCli(["show"], system.value, async () => {
        throw new Error("secret details");
      }),
    ).toBe(ExitCode.system);
    expect(system.errors).toEqual(["Unexpected system error"]);
  });

  it("loads and validates configuration before dispatch", async () => {
    const streams = io({ FINANCE_LOG_LEVEL: "verbose" });
    expect(await runCli(["show"], streams.value)).toBe(ExitCode.validation);
    expect(streams.errors[0]).toContain("FINANCE_LOG_LEVEL");
  });
});
