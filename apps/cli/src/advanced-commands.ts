import { DateRange, LocalDate } from "@family-finance/application";

import { CliValidationError, type CliContext, type CliIO } from "./index.js";
import { jsonSuccess } from "./json-output.js";

export const advancedOperations = [
  "budget:summary",
  "analytics:breakdown",
  "budget:compare",
  "budget:forecast",
  "bill:list",
  "reminder:process",
] as const;
export type AdvancedOperation = (typeof advancedOperations)[number];
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
    const period = parsePeriod(arguments_);
    const result = await gateway.execute(command as AdvancedOperation, {
      databasePath: context.config.database.path,
      period,
      raw: arguments_,
    });
    if (arguments_.includes("--json")) io.log(jsonSuccess(result));
    else
      io.log(
        `${command} | ${period.start.toString()} through ${period.endExclusive.addDays(-1).toString()}\n${JSON.stringify(result, null, 2)}`,
      );
  };
}
