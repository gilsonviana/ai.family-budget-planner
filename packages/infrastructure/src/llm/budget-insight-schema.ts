import type {
  GeneratedBudgetInsight,
  StructuredResultValidator,
} from "@family-finance/application";
import { z } from "zod";

export const budgetInsightSchema = z
  .object({
    actions: z.array(z.string().trim().min(1)).max(10),
    observations: z.array(z.string().trim().min(1)).max(10),
    summary: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const budgetInsightValidator: StructuredResultValidator<GeneratedBudgetInsight> =
  {
    name: "BudgetInsight",
    parse: (value) => budgetInsightSchema.parse(value),
  };
