import {
  DateRange,
  LocalDate,
  type BudgetForecastService,
  type BudgetSummaryService,
  type PeriodAnalyticsService,
  type PeriodComparisonService,
} from "@family-finance/application";
import { z } from "zod";

import { registerTool, type ToolRegistrar } from "./tool-boundary.js";

export interface AnalyticsToolServices {
  readonly analytics: PeriodAnalyticsService;
  readonly comparisons: PeriodComparisonService;
  readonly forecasts: BudgetForecastService;
  readonly summaries: BudgetSummaryService;
}

const familyId = z.string().trim().min(1).max(128);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const periodSchema = z.object({ from: date, to: date }).strict();
const requestSchema = z.object({ familyId, period: periodSchema }).strict();

function period(input: z.infer<typeof periodSchema>): DateRange {
  return DateRange.inclusive(
    LocalDate.fromISO(input.from),
    LocalDate.fromISO(input.to),
  );
}

function calculated<T>(value: T): { calculated: T; provenance: "application" } {
  return { calculated: value, provenance: "application" };
}

export function registerAnalyticsTools(
  server: ToolRegistrar,
  services: AnalyticsToolServices,
): void {
  registerTool(
    server,
    "budget_summary",
    "Budget summary",
    "Calculate expected income, expenses, and balance for an inclusive period.",
    requestSchema,
    async (input) =>
      calculated(
        await services.summaries.summarize(
          input.familyId,
          period(input.period),
        ),
      ),
  );
  registerTool(
    server,
    "analytics_breakdown",
    "Analytics breakdown",
    "Calculate income-by-member and expense-by-category breakdowns.",
    requestSchema,
    async (input) =>
      calculated(
        await services.analytics.analyze(input.familyId, period(input.period)),
      ),
  );
  const comparisonSchema = z
    .object({
      familyId,
      baseline: periodSchema,
      compared: periodSchema,
    })
    .strict();
  registerTool(
    server,
    "budget_compare",
    "Compare budget periods",
    "Compare calculated budget metrics across two inclusive periods.",
    comparisonSchema,
    async (input) =>
      calculated(
        await services.comparisons.compare(
          input.familyId,
          period(input.baseline),
          period(input.compared),
        ),
      ),
  );
  const forecastSchema = requestSchema.extend({
    granularity: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  });
  registerTool(
    server,
    "budget_forecast",
    "Budget forecast",
    "Calculate forecast buckets for an inclusive period.",
    forecastSchema,
    async (input) =>
      calculated(
        await services.forecasts.forecast(
          input.familyId,
          period(input.period),
          input.granularity,
        ),
      ),
  );
}
