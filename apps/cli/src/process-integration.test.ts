import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const executable = resolve(root, "apps/cli/dist/finance.js");
const temporary = mkdtempSync(join(tmpdir(), "finance-cli-integration-"));
const databasePath = join(temporary, "finance.sqlite");
const environment = { ...process.env, FINANCE_DATABASE_PATH: databasePath };

function run(...arguments_: string[]) {
  const result = spawnSync(process.execPath, [executable, ...arguments_], {
    cwd: root,
    encoding: "utf8",
    env: environment,
  });
  return {
    ...result,
    json: JSON.parse(result.stdout || result.stderr) as {
      data?: Record<string, unknown>;
      error?: { code: string; message: string };
      version: number;
    },
  };
}

describe.sequential("packaged CLI process contract", () => {
  beforeAll(() => {
    execFileSync("pnpm", ["--filter", "@family-finance/cli", "build"], {
      cwd: root,
      stdio: "pipe",
    });
  });
  afterAll(() => rmSync(temporary, { recursive: true, force: true }));

  it("runs the six-command README plan against persistent SQLite", () => {
    const commands = [
      [
        "family:create",
        "--json",
        "--data",
        JSON.stringify({
          id: "viana-family",
          name: "Viana Family",
          settings: {
            currency: "BRL",
            locale: "pt-BR",
            timeZone: "America/Sao_Paulo",
            weekStartsOn: 1,
          },
        }),
      ],
      [
        "member:add",
        "--json",
        "--data",
        JSON.stringify({
          familyId: "viana-family",
          id: "gilson",
          name: "Gilson",
        }),
      ],
      [
        "income:create",
        "--json",
        "--data",
        JSON.stringify({
          id: "salary",
          familyId: "viana-family",
          memberId: "gilson",
          source: "Salary",
          amount: { value: "8000.00", currency: "BRL" },
          recurrence: { frequency: "monthly", startDate: "2026-01-05" },
        }),
      ],
      [
        "expense:category-create",
        "--json",
        "--data",
        JSON.stringify({
          id: "housing",
          familyId: "viana-family",
          name: "Housing",
        }),
      ],
      [
        "expense:create",
        "--json",
        "--data",
        JSON.stringify({
          id: "rent",
          familyId: "viana-family",
          categoryId: "housing",
          name: "Rent",
          amount: { value: "2500.00", currency: "BRL" },
          recurrence: { frequency: "monthly", startDate: "2026-01-10" },
        }),
      ],
      [
        "budget:summary",
        "--family-id",
        "viana-family",
        "--from",
        "2026-09-01",
        "--to",
        "2026-09-30",
        "--json",
      ],
    ];

    const results = commands.map((command) => run(...command));
    expect(results.every(({ status }) => status === 0)).toBe(true);
    expect(results.every(({ json }) => json.version === 1 && json.data)).toBe(
      true,
    );
    expect(existsSync(databasePath)).toBe(true);
    expect(results[5]?.json.data).toMatchObject({
      currency: "BRL",
      expectedExpenses: { amount: "2500.00", currency: "BRL" },
      expectedIncome: { amount: "8000.00", currency: "BRL" },
      projectedBalance: { amount: "5500.00", currency: "BRL" },
    });
  });

  it("reads prior state in a fresh process and reports stable conflicts", () => {
    const read = run(
      "family:get",
      "--json",
      "--data",
      JSON.stringify({ id: "viana-family" }),
    );
    expect(read.status).toBe(0);
    expect(read.json.data).toMatchObject({
      id: "viana-family",
      name: "Viana Family",
    });

    const duplicate = run(
      "family:create",
      "--json",
      "--data",
      JSON.stringify({
        id: "viana-family",
        name: "Duplicate",
        settings: {
          currency: "BRL",
          locale: "pt-BR",
          timeZone: "America/Sao_Paulo",
          weekStartsOn: 1,
        },
      }),
    );
    expect(duplicate.status).toBe(4);
    expect(duplicate.json.error).toEqual({
      code: "CONFLICT",
      message: "family already exists: viana-family",
    });
  });
});
