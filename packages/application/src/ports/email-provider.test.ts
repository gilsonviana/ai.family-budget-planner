import { LocalDate, Money } from "@family-finance/domain";
import { describe, expect, it } from "vitest";

import { EmailProviderError, type EmailProvider } from "./email-provider.js";

describe("EmailProvider", () => {
  it("carries all recipient and bill details through the neutral contract", async () => {
    const provider: EmailProvider = {
      send: async (message) => ({
        providerMessageId: `${message.billId}:${message.recipient}`,
      }),
    };
    await expect(
      provider.send({
        amount: Money.fromDecimal("75", "USD"),
        billId: "power",
        billName: "Power",
        dueDate: LocalDate.fromISO("2026-05-10"),
        from: "budget@example.com",
        recipient: "family@example.com",
        subject: "Bill due",
      }),
    ).resolves.toEqual({ providerMessageId: "power:family@example.com" });
  });

  it("represents provider failures without vendor types", () => {
    const error = new EmailProviderError(
      "rateLimit",
      true,
      "Delivery temporarily limited",
    );
    expect({ kind: error.kind, retryable: error.retryable }).toEqual({
      kind: "rateLimit",
      retryable: true,
    });
  });
});
