import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const temporary = mkdtempSync(join(tmpdir(), "finance-cli-smoke-"));
try {
  const packed = JSON.parse(
    execFileSync("pnpm", ["pack", "--json", "--pack-destination", temporary], {
      encoding: "utf8",
    }),
  );
  const artifact = packed.filename;
  execFileSync("npm", ["init", "-y"], { cwd: temporary, stdio: "ignore" });
  execFileSync("npm", ["install", "--ignore-scripts", artifact], {
    cwd: temporary,
    stdio: "ignore",
  });
  const binary = join(temporary, "node_modules", ".bin", "finance");
  const help = execFileSync(binary, ["--help"], { encoding: "utf8" });
  if (!help.includes("Family Finance Planner"))
    throw new Error("finance --help failed");
  const created = execFileSync(
    binary,
    [
      "family:create",
      "--json",
      "--data",
      JSON.stringify({
        id: "smoke-family",
        name: "Smoke Family",
        settings: {
          currency: "BRL",
          locale: "pt-BR",
          timeZone: "America/Sao_Paulo",
          weekStartsOn: 1,
        },
      }),
    ],
    { encoding: "utf8" },
  );
  if (!created.includes("smoke-family"))
    throw new Error("family:create smoke workflow failed");
  const manifest = readFileSync(
    join(temporary, "node_modules", "@family-finance", "cli", "package.json"),
    "utf8",
  );
  if (manifest.includes("FINANCE_LLM_API_KEY="))
    throw new Error("published package contains a secret");
  process.stdout.write(`CLI package smoke test passed: ${artifact}\n`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
