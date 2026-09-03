import { z } from "zod";

export const configPackageName = "@family-finance/config";

const nonEmpty = z.string().trim().min(1);
const optionalNonEmpty = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  nonEmpty.optional(),
);

const environmentSchema = z
  .object({
    FINANCE_DATABASE_PATH: nonEmpty.default("./finance.db"),
    FINANCE_LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .default("info"),
    FINANCE_LLM_PROVIDER: optionalNonEmpty,
    FINANCE_LLM_MODEL: optionalNonEmpty,
    FINANCE_LLM_API_KEY: optionalNonEmpty,
    FINANCE_EMAIL_PROVIDER: optionalNonEmpty,
    FINANCE_EMAIL_FROM: optionalNonEmpty,
    FINANCE_EMAIL_API_KEY: optionalNonEmpty,
  })
  .superRefine((environment, context) => {
    for (const [provider, requirements] of [
      ["FINANCE_LLM_PROVIDER", ["FINANCE_LLM_MODEL", "FINANCE_LLM_API_KEY"]],
      [
        "FINANCE_EMAIL_PROVIDER",
        ["FINANCE_EMAIL_FROM", "FINANCE_EMAIL_API_KEY"],
      ],
    ] as const) {
      if (environment[provider]) {
        for (const requirement of requirements) {
          if (!environment[requirement]) {
            context.addIssue({
              code: "custom",
              message: `is required when ${provider} is configured`,
              path: [requirement],
            });
          }
        }
      }
    }
  });

export type LogLevel = z.infer<typeof environmentSchema>["FINANCE_LOG_LEVEL"];

export interface ApplicationConfig {
  readonly database: { readonly path: string };
  readonly logging: { readonly level: LogLevel };
  readonly llm?: {
    readonly provider: string;
    readonly model: string;
    readonly apiKey: string;
  };
  readonly email?: {
    readonly provider: string;
    readonly from: string;
    readonly apiKey: string;
  };
}

export type PublicApplicationConfig = Omit<
  ApplicationConfig,
  "llm" | "email"
> & {
  readonly llm?: Omit<NonNullable<ApplicationConfig["llm"]>, "apiKey"> & {
    readonly apiKey: "[REDACTED]";
  };
  readonly email?: Omit<NonNullable<ApplicationConfig["email"]>, "apiKey"> & {
    readonly apiKey: "[REDACTED]";
  };
};

export class ConfigurationError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid application configuration:\n- ${problems.join("\n- ")}`);
    this.name = "ConfigurationError";
    this.problems = problems;
  }
}

/** Loads configuration without requiring credentials for deterministic features. */
export function loadApplicationConfig(
  environment: Readonly<Record<string, string | undefined>> = {},
): ApplicationConfig {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    throw new ConfigurationError(
      parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    );
  }

  const values = parsed.data;
  return {
    database: { path: values.FINANCE_DATABASE_PATH },
    logging: { level: values.FINANCE_LOG_LEVEL },
    ...(values.FINANCE_LLM_PROVIDER &&
    values.FINANCE_LLM_MODEL &&
    values.FINANCE_LLM_API_KEY
      ? {
          llm: {
            provider: values.FINANCE_LLM_PROVIDER,
            model: values.FINANCE_LLM_MODEL,
            apiKey: values.FINANCE_LLM_API_KEY,
          },
        }
      : {}),
    ...(values.FINANCE_EMAIL_PROVIDER &&
    values.FINANCE_EMAIL_FROM &&
    values.FINANCE_EMAIL_API_KEY
      ? {
          email: {
            provider: values.FINANCE_EMAIL_PROVIDER,
            from: values.FINANCE_EMAIL_FROM,
            apiKey: values.FINANCE_EMAIL_API_KEY,
          },
        }
      : {}),
  };
}

/** Returns the only representation of configuration that is safe to log or persist. */
export function redactApplicationConfig(
  config: ApplicationConfig,
): PublicApplicationConfig {
  return {
    database: config.database,
    logging: config.logging,
    ...(config.llm
      ? {
          llm: {
            provider: config.llm.provider,
            model: config.llm.model,
            apiKey: "[REDACTED]",
          },
        }
      : {}),
    ...(config.email
      ? {
          email: {
            provider: config.email.provider,
            from: config.email.from,
            apiKey: "[REDACTED]",
          },
        }
      : {}),
  };
}
