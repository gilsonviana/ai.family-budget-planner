import { describe, expect, it, vi } from "vitest";

import {
  advancedOperations,
  createAdvancedCommandDispatcher,
} from "./advanced-commands.js";
import { runCli } from "./index.js";

describe("advanced planning commands", () => {
  it("routes every application operation using consistent period syntax", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ currency: "USD", total: "10.00" });
    const output: string[] = [];
    const io = {
      environment: {},
      error: vi.fn(),
      log: (value: string) => output.push(value),
    };
    const dispatch = createAdvancedCommandDispatcher({ execute }, io);
    for (const operation of advancedOperations)
      expect(
        await runCli(
          [operation, "--from", "2026-01-01", "--to", "2026-01-31"],
          io,
          dispatch,
        ),
      ).toBe(0);
    expect(execute).toHaveBeenCalledTimes(advancedOperations.length);
    expect(
      output.every(
        (line) =>
          line.includes("2026-01-01 through 2026-01-31") &&
          line.includes("USD"),
      ),
    ).toBe(true);
  });

  it("reports actionable period errors", async () => {
    const errors: string[] = [];
    const io = {
      environment: {},
      error: (value: string) => errors.push(value),
      log: vi.fn(),
    };
    expect(
      await runCli(
        ["budget:summary", "--from", "bad", "--to", "2026-01-31"],
        io,
        createAdvancedCommandDispatcher({ execute: vi.fn() }, io),
      ),
    ).toBe(2);
    expect(errors[0]).toContain("valid inclusive YYYY-MM-DD period");
  });
});
