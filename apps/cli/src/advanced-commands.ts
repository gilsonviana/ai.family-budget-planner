import { DateRange, LocalDate } from "@family-finance/application";

import { CliValidationError, type CliContext, type CliIO } from "./index.js";
import { jsonSuccess, prettySuccess } from "./json-output.js";

export const advancedOperations = [
  "budget:summary",
  "insight",
  "analytics:breakdown",
  "budget:compare",
  "budget:forecast",
  "bill:list",
  "reminder:process",
] as const;
export type AdvancedOperation = (typeof advancedOperations)[number];
export function hasLlmFlag(arguments_: readonly string[]): boolean {
  return arguments_.includes("--llm") || arguments_.includes("--LLM");
}

interface InsightSummary {
  readonly currency: string;
  readonly expectedExpenses: { toDecimal(): string };
  readonly expectedIncome: { toDecimal(): string };
  readonly period: {
    readonly endExclusive: { addDays(days: number): { toString(): string } };
    readonly start: { toString(): string };
  };
  readonly projectedBalance: { toDecimal(): string };
}
export interface AdvancedCommandGateway {
  execute(
    operation: AdvancedOperation,
    input: {
      readonly databasePath: string;
      readonly period: DateRange;
      readonly raw: readonly string[];
    },
  ): Promise<unknown>;
}

function value(arguments_: readonly string[], option: string): string {
  const index = arguments_.indexOf(option);
  const result = index < 0 ? undefined : arguments_[index + 1];
  if (!result)
    throw new CliValidationError(
      `${option} is required and must use YYYY-MM-DD`,
    );
  return result;
}
export function parsePeriod(arguments_: readonly string[]): DateRange {
  try {
    return DateRange.inclusive(
      LocalDate.fromISO(value(arguments_, "--from")),
      LocalDate.fromISO(value(arguments_, "--to")),
    );
  } catch (error) {
    if (error instanceof CliValidationError) throw error;
    throw new CliValidationError(
      "--from and --to must form a valid inclusive YYYY-MM-DD period",
    );
  }
}

function isInsightSummary(value: unknown): value is InsightSummary {
  return (
    value !== null &&
    typeof value === "object" &&
    "currency" in value &&
    "expectedExpenses" in value &&
    "expectedIncome" in value &&
    "period" in value &&
    "projectedBalance" in value
  );
}

export function prettyInsightSummary(summary: InsightSummary): string {
  return [
    `Budget summary: ${summary.period.start.toString()} through ${summary.period.endExclusive.addDays(-1).toString()}`,
    `Expected income: ${summary.currency} ${summary.expectedIncome.toDecimal()}`,
    `Expected expenses: ${summary.currency} ${summary.expectedExpenses.toDecimal()}`,
    `Projected balance: ${summary.currency} ${summary.projectedBalance.toDecimal()}`,
  ].join("\n");
}

export function createAdvancedCommandDispatcher(
  gateway: AdvancedCommandGateway,
  io: CliIO,
) {
  return async (
    command: string,
    arguments_: readonly string[],
    context: CliContext,
  ): Promise<void> => {
    if (!advancedOperations.includes(command as AdvancedOperation))
      throw new CliValidationError(`Unknown command: ${command}`);
    if (hasLlmFlag(arguments_) && command !== "insight")
      throw new CliValidationError(
        "--llm is supported only by the insight command",
      );
    if (hasLlmFlag(arguments_) && arguments_.includes("--json"))
      throw new CliValidationError("--llm and --json cannot be used together");
    const period = parsePeriod(arguments_);
    const result = await gateway.execute(command as AdvancedOperation, {
      databasePath: context.config.database.path,
      period,
      raw: arguments_,
    });
    if (hasLlmFlag(arguments_)) {
      if (typeof result !== "string")
        throw new CliValidationError("insight did not return LLM text");
      io.log(result);
    } else if (arguments_.includes("--json")) io.log(jsonSuccess(result));
    else if (
      command === "insight" &&
      arguments_.includes("--pretty") &&
      isInsightSummary(result)
    )
      io.log(prettyInsightSummary(result));
    else if (arguments_.includes("--pretty")) io.log(prettySuccess(result));
    else
      io.log(
        `${command} | ${period.start.toString()} through ${period.endExclusive.addDays(-1).toString()}\n${JSON.stringify(result, null, 2)}`,
      );
  };
}
