import {
  LlmProviderError,
  type LlmPrompt,
  type LlmProvider,
  type StructuredResultValidator,
} from "@family-finance/application";
import type { ApplicationConfig } from "@family-finance/config";
import OpenAI from "openai";

export interface OpenAIResponseBoundary {
  readonly model: string;
  readonly outputText: string;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  };
}
export interface OpenAITransport {
  create(input: {
    readonly apiKey: string;
    readonly model: string;
    readonly prompt: LlmPrompt;
    readonly schema?: {
      readonly name: string;
      readonly value: Readonly<Record<string, unknown>>;
    };
  }): Promise<OpenAIResponseBoundary>;
}

export class OpenAISdkTransport implements OpenAITransport {
  async create(
    input: Parameters<OpenAITransport["create"]>[0],
  ): Promise<OpenAIResponseBoundary> {
    const response = await new OpenAI({
      apiKey: input.apiKey,
    }).responses.create({
      input: [
        ...(input.prompt.system
          ? [{ content: input.prompt.system, role: "system" as const }]
          : []),
        { content: input.prompt.user, role: "user" as const },
      ],
      model: input.model,
      ...(input.schema
        ? {
            text: {
              format: {
                name: input.schema.name,
                schema: input.schema.value,
                strict: true,
                type: "json_schema" as const,
              },
            },
          }
        : {}),
    });
    return {
      model: String(response.model),
      outputText: response.output_text,
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
    };
  }
}

function mapFailure(error: unknown): LlmProviderError {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? error.status
      : undefined;
  if (status === 401 || status === 403)
    return new LlmProviderError(
      "authentication",
      false,
      "OpenAI rejected its credentials",
    );
  if (status === 429)
    return new LlmProviderError("rateLimit", true, "OpenAI rate limit reached");
  if (typeof status === "number" && status >= 500)
    return new LlmProviderError("unavailable", true, "OpenAI is unavailable");
  return new LlmProviderError("unknown", true, "OpenAI generation failed", {
    cause: error,
  });
}

export class OpenAILlmProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly model: string;
  constructor(
    config: ApplicationConfig,
    private readonly transport: OpenAITransport = new OpenAISdkTransport(),
  ) {
    if (!config.llm || config.llm.provider.toLowerCase() !== "openai")
      throw new LlmProviderError(
        "authentication",
        false,
        "OpenAI features are not configured",
      );
    this.apiKey = config.llm.apiKey;
    this.model = config.llm.model;
  }

  async generateText(prompt: LlmPrompt) {
    const response = await this.request(prompt);
    return {
      model: response.model,
      provider: "openai",
      usage: response.usage,
      value: response.outputText,
    };
  }
  async generateStructured<T>(
    prompt: LlmPrompt,
    validator: StructuredResultValidator<T>,
  ) {
    const response = await this.request(
      prompt,
      validator.jsonSchema
        ? { name: validator.name, value: validator.jsonSchema }
        : undefined,
    );
    try {
      return {
        model: response.model,
        provider: "openai",
        usage: response.usage,
        value: validator.parse(JSON.parse(response.outputText)),
      };
    } catch (cause) {
      throw new LlmProviderError(
        "invalidOutput",
        false,
        "OpenAI returned invalid structured output",
        { cause },
      );
    }
  }
  private async request(
    prompt: LlmPrompt,
    schema?: {
      readonly name: string;
      readonly value: Readonly<Record<string, unknown>>;
    },
  ) {
    try {
      return await this.transport.create({
        apiKey: this.apiKey,
        model: this.model,
        prompt,
        ...(schema ? { schema } : {}),
      });
    } catch (error) {
      if (error instanceof LlmProviderError) throw error;
      throw mapFailure(error);
    }
  }
}
