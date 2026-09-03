#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import {
  loadApplicationConfig,
  type ApplicationConfig,
} from "@family-finance/config";
import { initializeDatabase } from "@family-finance/infrastructure";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export const mcpPackageName = "@family-finance/mcp";
export const mcpVersion = "0.0.0";

interface ServerBoundary {
  close(): Promise<void>;
  connect(transport: TransportBoundary): Promise<void>;
}
interface TransportBoundary {
  onerror?: (error: Error) => void;
}
export interface McpRuntimeDependencies {
  createDatabase(path: string): { close(): void };
  createServer(config: ApplicationConfig): ServerBoundary;
  createTransport(): TransportBoundary;
  reportError(message: string): void;
}

const migrationsFolder = fileURLToPath(
  new URL("../../../packages/infrastructure/drizzle/", import.meta.url),
);

export class FinanceMcpRuntime {
  private closed = false;
  constructor(
    private readonly server: ServerBoundary,
    private readonly transport: TransportBoundary,
    private readonly database: { close(): void },
    private readonly reportError: (message: string) => void,
  ) {}
  async start(): Promise<void> {
    this.transport.onerror = (error) => {
      this.reportError(`MCP protocol error: ${error.message}`);
    };
    await this.server.connect(this.transport);
  }
  async shutdown(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.server.close();
    this.database.close();
  }
}

function defaultDependencies(): McpRuntimeDependencies {
  return {
    createDatabase: (path) => initializeDatabase(path, migrationsFolder),
    createServer: () =>
      new McpServer({ name: "family-finance", version: mcpVersion }),
    createTransport: () => new StdioServerTransport(),
    reportError: (message) => process.stderr.write(`${message}\n`),
  };
}

export async function startMcpServer(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  dependencies: McpRuntimeDependencies = defaultDependencies(),
): Promise<FinanceMcpRuntime> {
  const config = loadApplicationConfig(environment);
  const database = dependencies.createDatabase(config.database.path);
  const runtime = new FinanceMcpRuntime(
    dependencies.createServer(config),
    dependencies.createTransport(),
    database,
    dependencies.reportError,
  );
  try {
    await runtime.start();
    return runtime;
  } catch (error) {
    await runtime.shutdown();
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    const runtime = await startMcpServer();
    const shutdown = () =>
      void runtime.shutdown().finally(() => process.exit(0));
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "MCP server startup failed"}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], "file:").href
) {
  void main();
}
