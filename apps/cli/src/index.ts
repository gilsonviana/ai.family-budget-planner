#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  RepositoryConflictError,
  RepositoryNotFoundError,
} from "@family-finance/application";
import {
  ConfigurationError,
  loadApplicationConfig,
  type ApplicationConfig,
} from "@family-finance/config";
import { jsonError, type CliErrorCode } from "./json-output.js";
import { initializeDatabase } from "@family-finance/infrastructure";
import {
  createAdvancedCommandDispatcher,
  advancedOperations,
} from "./advanced-commands.js";
import { createFinanceCommandGateway } from "./command-gateway.js";
import {
  createCoreCommandDispatcher,
  corePlanningOperations,
} from "./core-commands.js";

export const cliPackageName = "@family-finance/cli";
export const cliVersion = "0.0.0";

export const ExitCode = Object.freeze({
  success: 0,
  system: 1,
  validation: 2,
  notFound: 3,
  conflict: 4,
} as const);

export class CliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliValidationError";
  }
}

export interface CliIO {
  readonly environment: Readonly<Record<string, string | undefined>>;
  error(message: string): void;
  log(message: string): void;
}
export interface CliContext {
  readonly config: ApplicationConfig;
}
export type CliDispatcher = (
  command: string,
  arguments_: readonly string[],
  context: CliContext,
) => Promise<void>;

const help = `Family Finance Planner

Usage: finance [options] <command>

Options:
  -h, --help     Show help
  -v, --version  Show version

Run "finance <command> --help" for command-specific help.`;

function errorMessage(error: unknown): {
  code: number;
  errorCode: CliErrorCode;
  message: string;
} {
  if (
    error instanceof ConfigurationError ||
    error instanceof CliValidationError
  ) {
    return {
      code: ExitCode.validation,
      errorCode: "VALIDATION_ERROR",
      message: error.message,
    };
  }
  if (error instanceof RepositoryNotFoundError) {
    return {
      code: ExitCode.notFound,
      errorCode: "NOT_FOUND",
      message: error.message,
    };
  }
  if (error instanceof RepositoryConflictError) {
    return {
      code: ExitCode.conflict,
      errorCode: "CONFLICT",
      message: error.message,
    };
  }
  return {
    code: ExitCode.system,
    errorCode: "SYSTEM_ERROR",
    message: "Unexpected system error",
  };
}

/** CLI adapter shell. Command handlers are injected so business rules remain in application services. */
export async function runCli(
  arguments_: readonly string[],
  io: CliIO,
  dispatch: CliDispatcher = async (command) => {
    throw new CliValidationError(`Unknown command: ${command}`);
  },
): Promise<number> {
  try {
    const config = loadApplicationConfig(io.environment);
    const [command, ...commandArguments] = arguments_;
    if (
      command === undefined ||
      command === "help" ||
      command === "--help" ||
      command === "-h"
    ) {
      io.log(help);
      return ExitCode.success;
    }
    if (command === "--version" || command === "-v" || command === "version") {
      io.log(cliVersion);
      return ExitCode.success;
    }
    await dispatch(command, commandArguments, { config });
    return ExitCode.success;
  } catch (error) {
    const mapped = errorMessage(error);
    io.error(
      arguments_.includes("--json")
        ? jsonError(mapped.errorCode, mapped.message)
        : mapped.message,
    );
    return mapped.code;
  }
}

async function main(): Promise<void> {
  const io: CliIO = {
    environment: process.env,
    error: (message) => process.stderr.write(`${message}\n`),
    log: (message) => process.stdout.write(`${message}\n`),
  };
  let database: ReturnType<typeof initializeDatabase> | undefined;
  try {
    const config = loadApplicationConfig(io.environment);
    const migrationsFolder = fileURLToPath(
      new URL("./drizzle/", import.meta.url),
    );
    database = initializeDatabase(config.database.path, migrationsFolder);
    const gateway = createFinanceCommandGateway(database.database, config);
    const core = createCoreCommandDispatcher(gateway, io);
    const advanced = createAdvancedCommandDispatcher(gateway, io);
    const dispatch: CliDispatcher = (command, args, context) =>
      corePlanningOperations.includes(command as never)
        ? core(command, args, context)
        : advancedOperations.includes(command as never)
          ? advanced(command, args, context)
          : Promise.reject(
              new CliValidationError(`Unknown command: ${command}`),
            );
    process.exitCode = await runCli(process.argv.slice(2), io, dispatch);
  } catch (error) {
    const mapped = errorMessage(error);
    io.error(jsonError(mapped.errorCode, mapped.message));
    process.exitCode = mapped.code;
  } finally {
    database?.close();
  }
}

if (
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main();
}

export * from "./core-commands.js";
export * from "./advanced-commands.js";
export * from "./command-gateway.js";
export * from "./json-output.js";
