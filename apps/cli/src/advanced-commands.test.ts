import { describe, expect, it, vi } from "vitest";
import { DateRange, LocalDate, Money } from "@family-finance/application";

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

  it("renders an indented versioned envelope with --pretty", async () => {
    const output: string[] = [];
    const io = {
      environment: {},
      error: vi.fn(),
      log: (value: string) => output.push(value),
    };
    const dispatch = createAdvancedCommandDispatcher(
      { execute: vi.fn().mockResolvedValue({ total: "10.00" }) },
      io,
    );
    await runCli(
      [
        "budget:summary",
        "--from",
        "2026-01-01",
        "--to",
        "2026-01-31",
        "--pretty",
      ],
      io,
      dispatch,
    );
    expect(output).toEqual([
      '{\n  "data": {\n    "total": "10.00"\n  },\n  "version": 1\n}',
    ]);
  });

  it("makes the insight command available with the standard period options", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ insight: { summary: "On track" } });
    const io = { environment: {}, error: vi.fn(), log: vi.fn() };
    const dispatch = createAdvancedCommandDispatcher({ execute }, io);
    expect(
      await runCli(
        [
          "insight",
          "--family-id",
          "family",
          "--from",
          "2026-01-01",
          "--to",
          "2026-01-31",
          "--json",
        ],
        io,
        dispatch,
      ),
    ).toBe(0);
    expect(execute).toHaveBeenCalledWith(
      "insight",
      expect.objectContaining({
        databasePath: "./finance.db",
        raw: expect.arrayContaining(["--family-id", "family"]),
      }),
    );
  });

  it("prints a readable deterministic insight summary with --pretty", async () => {
    const output: string[] = [];
    const io = {
      environment: {},
      error: vi.fn(),
      log: (value: string) => output.push(value),
    };
    const dispatch = createAdvancedCommandDispatcher(
      {
        execute: vi.fn().mockResolvedValue({
          currency: "BRL",
          expectedExpenses: Money.fromDecimal("2500", "BRL"),
          expectedIncome: Money.fromDecimal("8000", "BRL"),
          period: DateRange.inclusive(
            LocalDate.fromISO("2026-09-01"),
            LocalDate.fromISO("2026-09-30"),
          ),
          projectedBalance: Money.fromDecimal("5500", "BRL"),
        }),
      },
      io,
    );
    await runCli(
      [
        "insight",
        "--family-id",
        "family",
        "--from",
        "2026-09-01",
        "--to",
        "2026-09-30",
        "--pretty",
      ],
      io,
      dispatch,
    );
    expect(output).toEqual([
      "Budget summary: 2026-09-01 through 2026-09-30\nExpected income: BRL 8000.00\nExpected expenses: BRL 2500.00\nProjected balance: BRL 5500.00",
    ]);
  });

  it("prints only LLM prose when insight receives --llm", async () => {
    const output: string[] = [];
    const io = {
      environment: {},
      error: vi.fn(),
      log: (value: string) => output.push(value),
    };
    const dispatch = createAdvancedCommandDispatcher(
      { execute: vi.fn().mockResolvedValue("Your budget is on track.") },
      io,
    );
    await runCli(
      [
        "insight",
        "--family-id",
        "family",
        "--from",
        "2026-09-01",
        "--to",
        "2026-09-30",
        "--llm",
      ],
      io,
      dispatch,
    );
    expect(output).toEqual(["Your budget is on track."]);
  });

  it("continues to accept the original uppercase --LLM flag", async () => {
    const output: string[] = [];
    const io = {
      environment: {},
      error: vi.fn(),
      log: (value: string) => output.push(value),
    };
    const dispatch = createAdvancedCommandDispatcher(
      { execute: vi.fn().mockResolvedValue("Your budget is on track.") },
      io,
    );
    await runCli(
      [
        "insight",
        "--family-id",
        "family",
        "--from",
        "2026-09-01",
        "--to",
        "2026-09-30",
        "--LLM",
      ],
      io,
      dispatch,
    );
    expect(output).toEqual(["Your budget is on track."]);
  });
});
