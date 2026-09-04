import { RepositoryNotFoundError } from "@family-finance/application";
import { z } from "zod";

export type ToolResult = {
  readonly content: readonly [{ readonly text: string; readonly type: "text" }];
  readonly isError?: boolean;
};
export interface ToolRegistrar {
  registerTool(
    name: string,
    definition: {
      readonly description: string;
      readonly inputSchema: z.ZodType;
      readonly title: string;
    },
    handler: (input: unknown) => Promise<ToolResult>,
  ): void;
}

export class ToolUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolUnavailableError";
  }
}

function text(value: unknown): ToolResult {
  return {
    content: [
      {
        text: JSON.stringify(value, (_key, item) =>
          typeof item === "bigint" ? item.toString() : item,
        ),
        type: "text",
      },
    ],
  };
}

export async function safely<T>(
  operation: () => Promise<T>,
): Promise<ToolResult> {
  try {
    return text(await operation());
  } catch (error) {
    const code =
      error instanceof z.ZodError
        ? "INVALID_ARGUMENT"
        : error instanceof RepositoryNotFoundError
          ? "NOT_FOUND"
          : error instanceof ToolUnavailableError
            ? "PROVIDER_UNAVAILABLE"
            : "INTERNAL_ERROR";
    const message =
      code === "INTERNAL_ERROR"
        ? "The finance operation failed"
        : error instanceof Error
          ? error.message
          : "Invalid request";
    return { ...text({ error: { code, message } }), isError: true };
  }
}

export function registerTool<T extends z.ZodType>(
  server: ToolRegistrar,
  name: string,
  title: string,
  description: string,
  schema: T,
  run: (input: z.infer<T>) => Promise<unknown>,
): void {
  server.registerTool(
    name,
    { description, inputSchema: schema, title },
    (input) => safely(() => run(schema.parse(input))),
  );
}
