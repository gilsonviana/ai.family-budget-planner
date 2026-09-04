import { describe, expect, it, vi } from "vitest";

import { registerAnalyticsTools } from "./analytics-tools.js";
import type { ToolRegistrar } from "./tool-boundary.js";

function setup() {
  const handlers = new Map<string, (input: unknown) => Promise<unknown>>();
  const registrar: ToolRegistrar = {
    registerTool: (name, _definition, handler) => {
      handlers.set(name, handler);
    },
  };
  const services = {
    analytics: {
      analyze: vi
        .fn()
        .mockResolvedValue({
          incomeTotal: { currency: "BRL", minorUnits: 100n },
        }),
    },
    comparisons: {
      compare: vi
        .fn()
        .mockResolvedValue({ baselineDays: 31, comparedDays: 29 }),
    },
    forecasts: {
      forecast: vi
        .fn()
        .mockResolvedValue({ currency: "BRL", granularity: "monthly" }),
    },
    summaries: {
      summarize: vi
        .fn()
        .mockResolvedValue({
          currency: "BRL",
          projectedBalance: { minorUnits: 100n },
        }),
    },
  };
  registerAnalyticsTools(registrar, services as never);
  return { handlers, services };
}

describe("analytics MCP tools", () => {
  it("registers summary, breakdown, comparison, and forecast tools", () => {
    expect([...setup().handlers.keys()]).toEqual([
      "budget_summary",
      "analytics_breakdown",
      "budget_compare",
      "budget_forecast",
    ]);
  });

  it("routes an inclusive period through the application service", async () => {
    const { handlers, services } = setup();
    const result = await handlers.get("budget_summary")?.({
      familyId: "family",
      period: { from: "2026-02-01", to: "2026-02-28" },
    });
    const passedPeriod = services.summaries.summarize.mock.calls[0]?.[1];
    expect(passedPeriod.start.toString()).toBe("2026-02-01");
    expect(passedPeriod.endExclusive.toString()).toBe("2026-03-01");
    expect(result).toMatchObject({
      content: [
        { text: expect.stringContaining('"provenance":"application"') },
      ],
    });
  });

  it("rejects malformed requests before invoking calculations", async () => {
    const { handlers, services } = setup();
    const result = await handlers.get("budget_forecast")?.({
      familyId: "family",
      period: { from: "2026-02-01", to: "2026-02-28" },
      granularity: "daily",
    });
    expect(services.forecasts.forecast).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining("INVALID_ARGUMENT") }],
    });
  });
});
