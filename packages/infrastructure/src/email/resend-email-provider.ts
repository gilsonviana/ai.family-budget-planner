import {
  EmailProviderError,
  type EmailProvider,
  type ReminderEmailMessage,
} from "@family-finance/application";
import type { ApplicationConfig } from "@family-finance/config";

export interface ResendResponse {
  readonly body: unknown;
  readonly status: number;
}
export interface ResendTransport {
  post(
    apiKey: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<ResendResponse>;
}

export class FetchResendTransport implements ResendTransport {
  async post(
    apiKey: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<ResendResponse> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        body: JSON.stringify(payload),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      return { body: await response.json(), status: response.status };
    } catch (cause) {
      throw new EmailProviderError(
        "unavailable",
        true,
        "Email provider is unavailable",
        { cause },
      );
    }
  }
}

function failure(status: number): EmailProviderError {
  if (status === 401 || status === 403)
    return new EmailProviderError(
      "authentication",
      false,
      "Email provider rejected its credentials",
    );
  if (status === 429)
    return new EmailProviderError(
      "rateLimit",
      true,
      "Email provider rate limit reached",
    );
  if (status >= 500)
    return new EmailProviderError(
      "unavailable",
      true,
      "Email provider is unavailable",
    );
  return new EmailProviderError(
    "rejected",
    false,
    "Email provider rejected the message",
  );
}

export class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly configuredFrom: string;
  constructor(
    config: ApplicationConfig,
    private readonly transport: ResendTransport = new FetchResendTransport(),
  ) {
    if (!config.email || config.email.provider.toLowerCase() !== "resend") {
      throw new EmailProviderError(
        "authentication",
        false,
        "Resend email configuration is not enabled",
      );
    }
    this.apiKey = config.email.apiKey;
    this.configuredFrom = config.email.from;
  }

  async send(message: ReminderEmailMessage) {
    const response = await this.transport.post(this.apiKey, {
      from: this.configuredFrom,
      html: `<p>${message.billName} (${message.amount.toDecimal()} ${message.amount.currency}) is due ${message.dueDate.toString()}.</p>`,
      subject: message.subject,
      to: [message.recipient],
    });
    if (response.status < 200 || response.status >= 300)
      throw failure(response.status);
    const id =
      typeof response.body === "object" &&
      response.body !== null &&
      "id" in response.body
        ? response.body.id
        : undefined;
    if (typeof id !== "string" || id.length === 0)
      throw new EmailProviderError(
        "unknown",
        false,
        "Email provider returned an invalid receipt",
      );
    return { providerMessageId: id };
  }
}
