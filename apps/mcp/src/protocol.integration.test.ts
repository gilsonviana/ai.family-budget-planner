import { RepositoryNotFoundError } from "@family-finance/application";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerAnalyticsTools } from "./analytics-tools.js";
import { registerPlanningTools } from "./planning-tools.js";
import type { ToolRegistrar } from "./tool-boundary.js";

const open: Array<{ close(): Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((item) => item.close()));
});

async function connected(register: (server: ToolRegistrar) => void) {
  const server = new McpServer({ name: "test-finance", version: "1.0.0" });
  register(server as unknown as ToolRegistrar);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  open.push(client, server);
  return client;
}

describe("MCP protocol boundary", () => {
  it("advertises explicit schemas and routes a representative calculation", async () => {
    const summarize = vi.fn().mockResolvedValue({
      currency: "BRL",
      projectedBalance: { minorUnits: 12500n },
    });
    const client = await connected((server) =>
      registerAnalyticsTools(server, {
        analytics: { analyze: vi.fn() },
        comparisons: { compare: vi.fn() },
        forecasts: { forecast: vi.fn() },
        summaries: { summarize },
      } as never),
    );
    const listed = await client.listTools();
    expect(
      listed.tools.find((tool) => tool.name === "budget_summary")?.inputSchema,
    ).toMatchObject({ type: "object", additionalProperties: false });
    const result = await client.callTool({
      name: "budget_summary",
      arguments: {
        familyId: "family",
        period: { from: "2026-04-01", to: "2026-04-30" },
      },
    });
    expect(summarize).toHaveBeenCalledOnce();
    expect(result.isError).not.toBe(true);
    const payload = JSON.parse(
      (
        (result as { content: Array<{ text: string }> }).content[0] as {
          text: string;
        }
      ).text,
    );
    expect(payload).toMatchObject({
      calculated: { currency: "BRL" },
      provenance: "application",
    });
  });

  it("returns protocol errors for invalid input and missing records", async () => {
    const get = vi
      .fn()
      .mockRejectedValue(new RepositoryNotFoundError("family", "missing"));
    const client = await connected((server) =>
      registerPlanningTools(server, {
        bills: { get: vi.fn() },
        expenses: { list: vi.fn() },
        families: { create: vi.fn(), get },
        incomes: { list: vi.fn() },
        members: { add: vi.fn(), list: vi.fn() },
      } as never),
    );
    const invalid = await client.callTool({
      name: "family_get",
      arguments: { familyId: "" },
    });
    expect(invalid.isError).toBe(true);
    expect(JSON.stringify(invalid.content)).toContain("Input validation error");
    const missing = await client.callTool({
      name: "family_get",
      arguments: { familyId: "missing" },
    });
    expect(missing.isError).toBe(true);
    expect(JSON.stringify(missing.content)).toContain("NOT_FOUND");
  });
});
