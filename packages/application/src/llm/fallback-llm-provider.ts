import {
  LlmProviderError,
  type LlmPrompt,
  type LlmProvider,
  type LlmProviderFailureKind,
  type LlmResult,
  type StructuredResultValidator,
} from "../ports/llm-provider.js";

export interface NamedLlmProvider {
  readonly name: string;
  readonly provider: LlmProvider;
}
export interface SafeLlmLogger {
  warn(event: {
    readonly event: "llm_provider_failed";
    readonly kind: LlmProviderFailureKind;
    readonly provider: string;
    readonly retryable: boolean;
  }): void;
}
export interface LlmFallbackAttempt {
  readonly kind: LlmProviderFailureKind;
  readonly provider: string;
  readonly retryable: boolean;
}

export class LlmFallbackError extends LlmProviderError {
  constructor(readonly attempts: readonly LlmFallbackAttempt[]) {
    super(
      "unavailable",
      attempts.some((attempt) => attempt.retryable),
      `All configured LLM providers failed: ${attempts.map((attempt) => `${attempt.provider} (${attempt.kind})`).join(", ")}`,
    );
    this.name = "LlmFallbackError";
  }
}

export class FallbackLlmProvider implements LlmProvider {
  constructor(
    private readonly providers: readonly NamedLlmProvider[],
    private readonly logger?: SafeLlmLogger,
  ) {
    if (providers.length === 0)
      throw new LlmProviderError(
        "authentication",
        false,
        "No LLM providers are configured",
      );
  }

  generateText(prompt: LlmPrompt): Promise<LlmResult<string>> {
    return this.tryProviders((provider) => provider.generateText(prompt));
  }
  generateStructured<T>(
    prompt: LlmPrompt,
    validator: StructuredResultValidator<T>,
  ): Promise<LlmResult<T>> {
    return this.tryProviders((provider) =>
      provider.generateStructured(prompt, validator),
    );
  }

  private async tryProviders<T>(
    operation: (provider: LlmProvider) => Promise<LlmResult<T>>,
  ): Promise<LlmResult<T>> {
    const attempts: LlmFallbackAttempt[] = [];
    for (const candidate of this.providers) {
      try {
        return await operation(candidate.provider);
      } catch (error) {
        const failure =
          error instanceof LlmProviderError
            ? error
            : new LlmProviderError("unknown", true, "Provider failed", {
                cause: error,
              });
        const attempt = {
          kind: failure.kind,
          provider: candidate.name,
          retryable: failure.retryable,
        };
        attempts.push(attempt);
        this.logger?.warn({ event: "llm_provider_failed", ...attempt });
      }
    }
    throw new LlmFallbackError(Object.freeze(attempts));
  }
}
