export interface LlmPrompt {
  readonly system?: string;
  readonly user: string;
}
export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}
export interface LlmResult<T> {
  readonly model: string;
  readonly provider: string;
  readonly usage: LlmUsage;
  readonly value: T;
}
export interface StructuredResultValidator<T> {
  readonly name: string;
  parse(value: unknown): T;
}
export type LlmProviderFailureKind =
  | "authentication"
  | "invalidOutput"
  | "rateLimit"
  | "safety"
  | "timeout"
  | "unavailable"
  | "unknown";

export class LlmProviderError extends Error {
  constructor(
    readonly kind: LlmProviderFailureKind,
    readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LlmProviderError";
  }
}

export interface LlmProvider {
  generateText(prompt: LlmPrompt): Promise<LlmResult<string>>;
  generateStructured<T>(
    prompt: LlmPrompt,
    validator: StructuredResultValidator<T>,
  ): Promise<LlmResult<T>>;
}
