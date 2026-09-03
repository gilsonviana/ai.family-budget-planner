import type { LocalDate, Money } from "@family-finance/domain";

export interface ReminderEmailMessage {
  readonly amount: Money;
  readonly billId: string;
  readonly billName: string;
  readonly dueDate: LocalDate;
  readonly from: string;
  readonly recipient: string;
  readonly subject: string;
}
export interface EmailDeliveryReceipt {
  readonly providerMessageId: string;
}
export type EmailProviderFailureKind =
  "authentication" | "rateLimit" | "rejected" | "unavailable" | "unknown";

export class EmailProviderError extends Error {
  constructor(
    readonly kind: EmailProviderFailureKind,
    readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EmailProviderError";
  }
}

/** Provider-neutral boundary; adapters own all vendor request and response types. */
export interface EmailProvider {
  send(message: ReminderEmailMessage): Promise<EmailDeliveryReceipt>;
}
