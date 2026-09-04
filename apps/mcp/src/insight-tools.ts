import {
  DateRange,
  LocalDate,
  type AiPeriodSummaryService,
} from "@family-finance/application";
import { z } from "zod";

import {
  registerTool,
  ToolUnavailableError,
  type ToolRegistrar,
} from "./tool-boundary.js";

const schema = z
  .object({
    familyId: z.string().trim().min(1).max(128),
    period: z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .strict(),
  })
  .strict();

/** Registers a credential-free caller schema; provider credentials remain deployment configuration. */
export function registerInsightTools(
  server: ToolRegistrar,
  service?: AiPeriodSummaryService,
): void {
  registerTool(
    server,
    "ai_period_summary",
    "AI period summary",
    "Explain calculated budget facts using the server-configured AI provider.",
    schema,
    (input) => {
      if (!service)
        throw new ToolUnavailableError(
          "AI insights are not configured on this server",
        );
      return service.summarize(
        input.familyId,
        DateRange.inclusive(
          LocalDate.fromISO(input.period.from),
          LocalDate.fromISO(input.period.to),
        ),
      );
    },
  );
}
