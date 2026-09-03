import { describe, expect, it, vi } from "vitest";

import { startMcpServer } from "./index.js";

describe("MCP server runtime", () => {
  it("starts independently with validated config and shuts down once", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const closeServer = vi.fn().mockResolvedValue(undefined);
    const closeDatabase = vi.fn();
    const createDatabase = vi.fn().mockReturnValue({ close: closeDatabase });
    const transport: { onerror?: (error: Error) => void } = {};
    const errors: string[] = [];
    const runtime = await startMcpServer(
      { FINANCE_DATABASE_PATH: "/data/finance.sqlite" },
      {
        createDatabase,
        createServer: () => ({ close: closeServer, connect }),
        createTransport: () => transport,
        reportError: (message) => errors.push(message),
      },
    );
    expect(createDatabase).toHaveBeenCalledWith("/data/finance.sqlite");
    expect(connect).toHaveBeenCalledTimes(1);
    transport.onerror?.(new Error("bad frame"));
    expect(errors).toEqual(["MCP protocol error: bad frame"]);
    await runtime.shutdown();
    await runtime.shutdown();
    expect(closeServer).toHaveBeenCalledTimes(1);
    expect(closeDatabase).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid deployment configuration before opening the database", async () => {
    const createDatabase = vi.fn();
    await expect(
      startMcpServer(
        { FINANCE_LOG_LEVEL: "verbose" },
        {
          createDatabase,
          createServer: vi.fn(),
          createTransport: vi.fn(),
          reportError: vi.fn(),
        },
      ),
    ).rejects.toThrow("FINANCE_LOG_LEVEL");
    expect(createDatabase).not.toHaveBeenCalled();
  });
});
