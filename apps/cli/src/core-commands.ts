import { CliValidationError, type CliContext, type CliIO } from "./index.js";
import { jsonSuccess, prettySuccess } from "./json-output.js";

export const corePlanningOperations = [
  "family:create",
  "family:get",
  "family:update",
  "member:add",
  "member:list",
  "member:edit",
  "member:remove",
  "income:create",
  "income:get",
  "income:list",
  "income:update",
  "income:deactivate",
  "expense:category-create",
  "expense:category-deactivate",
  "expense:create",
  "expense:get",
  "expense:list",
  "expense:update",
  "expense:deactivate",
] as const;
export type CorePlanningOperation = (typeof corePlanningOperations)[number];

export interface CorePlanningGateway {
  execute(
    operation: CorePlanningOperation,
    input: Readonly<Record<string, unknown>>,
    databasePath: string,
  ): Promise<unknown>;
}

function inputFrom(
  arguments_: readonly string[],
): Readonly<Record<string, unknown>> {
  const dataIndex = arguments_.indexOf("--data");
  if (dataIndex < 0 || arguments_[dataIndex + 1] === undefined) {
    throw new CliValidationError(
      'Commands require --data with a JSON object, for example --data \'{"id":"family"}\'',
    );
  }
  const raw = arguments_[dataIndex + 1];
  if (raw === undefined) throw new CliValidationError("--data is required");
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")
      throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new CliValidationError("--data must contain a valid JSON object");
  }
}

export function createCoreCommandDispatcher(
  gateway: CorePlanningGateway,
  io: CliIO,
) {
  return async (
    command: string,
    arguments_: readonly string[],
    context: CliContext,
  ): Promise<void> => {
    if (!corePlanningOperations.includes(command as CorePlanningOperation))
      throw new CliValidationError(`Unknown command: ${command}`);
    const result = await gateway.execute(
      command as CorePlanningOperation,
      inputFrom(arguments_),
      context.config.database.path,
    );
    if (result !== undefined) {
      io.log(
        arguments_.includes("--json")
          ? jsonSuccess(result)
          : arguments_.includes("--pretty")
            ? prettySuccess(result)
            : JSON.stringify(result, null, 2),
      );
    }
  };
}
