import { describe, expect, it, vi } from "vitest";

import {
  corePlanningOperations,
  createCoreCommandDispatcher,
} from "./core-commands.js";
import { runCli } from "./index.js";

describe("core planning commands", () => {
  it("makes every lifecycle operation reachable and targets the configured database", async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true });
    const output: string[] = [];
    const io = {
      environment: { FINANCE_DATABASE_PATH: "/data/family.sqlite" },
      error: vi.fn(),
      log: (value: string) => output.push(value),
    };
    const dispatch = createCoreCommandDispatcher({ execute }, io);
    for (const operation of corePlanningOperations)
      expect(await runCli([operation, "--data", "{}"], io, dispatch)).toBe(0);
    expect(execute).toHaveBeenCalledTimes(corePlanningOperations.length);
    expect(
      execute.mock.calls.every((call) => call[2] === "/data/family.sqlite"),
    ).toBe(true);
    expect(output).toHaveLength(corePlanningOperations.length);
  });

  it("returns actionable validation for malformed input", async () => {
    const errors: string[] = [];
    const io = {
      environment: {},
      error: (value: string) => errors.push(value),
      log: vi.fn(),
    };
    const dispatch = createCoreCommandDispatcher({ execute: vi.fn() }, io);
    expect(await runCli(["family:create", "--data", "{"], io, dispatch)).toBe(
      2,
    );
    expect(errors).toEqual(["--data must contain a valid JSON object"]);
  });

  it("renders an indented versioned envelope with --pretty", async () => {
    const output: string[] = [];
    const io = {
      environment: {},
      error: vi.fn(),
      log: (value: string) => output.push(value),
    };
    const dispatch = createCoreCommandDispatcher(
      { execute: vi.fn().mockResolvedValue({ created: true }) },
      io,
    );
    await runCli(["family:create", "--data", "{}", "--pretty"], io, dispatch);
    expect(output).toEqual([
      '{\n  "data": {\n    "created": true\n  },\n  "version": 1\n}',
    ]);
  });
});
