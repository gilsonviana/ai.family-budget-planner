import { describe, expect, it, vi } from "vitest";

import { createCoreCommandDispatcher } from "./core-commands.js";
import { runCli } from "./index.js";
import { jsonSuccess } from "./json-output.js";

describe("stable JSON output", () => {
  it("canonicalizes keys inside a versioned success envelope", () => {
    expect(jsonSuccess({ z: 1, a: { y: 2, b: 3 } })).toBe(
      '{"data":{"a":{"b":3,"y":2},"z":1},"version":1}',
    );
  });

  it("writes machine-readable errors only to stderr", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const io = {
      environment: {},
      error: (value: string) => stderr.push(value),
      log: (value: string) => stdout.push(value),
    };
    const dispatcher = createCoreCommandDispatcher({ execute: vi.fn() }, io);
    expect(
      await runCli(["family:get", "--json", "--data", "{"], io, dispatcher),
    ).toBe(2);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([
      '{"error":{"code":"VALIDATION_ERROR","message":"--data must contain a valid JSON object"},"version":1}',
    ]);
  });
});
