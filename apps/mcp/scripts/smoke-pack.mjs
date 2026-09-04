import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const temporary = mkdtempSync(join(tmpdir(), "finance-mcp-smoke-"));
let client;
try {
  const packed = JSON.parse(
    execFileSync("pnpm", ["pack", "--json", "--pack-destination", temporary], {
      encoding: "utf8",
    }),
  );
  execFileSync("npm", ["init", "-y"], { cwd: temporary, stdio: "ignore" });
  execFileSync("npm", ["install", packed.filename], {
    cwd: temporary,
    stdio: "ignore",
  });
  const binary = join(temporary, "node_modules", ".bin", "finance-mcp");
  client = new Client({ name: "package-smoke", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: binary,
      env: {
        ...process.env,
        FINANCE_DATABASE_PATH: join(temporary, "finance.sqlite"),
      },
      stderr: "pipe",
    }),
  );
  const result = await client.callTool({
    name: "family_create",
    arguments: {
      id: "smoke-family",
      name: "Smoke Family",
      currency: "BRL",
      locale: "pt-BR",
      timeZone: "America/Sao_Paulo",
      weekStartsOn: 1,
    },
  });
  if (
    result.isError ||
    !JSON.stringify(result.content).includes("smoke-family")
  )
    throw new Error("representative MCP tool call failed");
  process.stdout.write(`MCP package smoke test passed: ${packed.filename}\n`);
} finally {
  await client?.close();
  rmSync(temporary, { recursive: true, force: true });
}
