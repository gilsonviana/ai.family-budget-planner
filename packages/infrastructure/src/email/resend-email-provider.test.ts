import { LocalDate, Money } from "@family-finance/domain";
import { describe, expect, it, vi } from "vitest";

import { ResendEmailProvider } from "./resend-email-provider.js";

const config = {
  database: { path: "db" },
  logging: { level: "info" as const },
  email: { provider: "resend", from: "budget@example.com", apiKey: "secret" },
};
const message = {
  amount: Money.fromDecimal("25", "USD"),
  billId: "power",
  billName: "Power",
  dueDate: LocalDate.fromISO("2026-06-01"),
  from: "ignored@example.com",
  recipient: "family@example.com",
  subject: "Upcoming bill",
};
describe("ResendEmailProvider", () => {
  it("uses validated credentials and maps a receipt through a mock boundary", async () => {
    const post = vi
      .fn()
      .mockResolvedValue({ body: { id: "email-1" }, status: 200 });
    await expect(
      new ResendEmailProvider(config, { post }).send(message),
    ).resolves.toEqual({ providerMessageId: "email-1" });
    expect(post).toHaveBeenCalledWith(
      "secret",
      expect.objectContaining({
        from: "budget@example.com",
        to: ["family@example.com"],
      }),
    );
  });

  it.each([
    [401, "authentication", false],
    [429, "rateLimit", true],
    [503, "unavailable", true],
  ])(
    "maps status %s to neutral %s failure",
    async (status, kind, retryable) => {
      const provider = new ResendEmailProvider(config, {
        post: vi.fn().mockResolvedValue({ body: {}, status }),
      });
      await expect(provider.send(message)).rejects.toMatchObject({
        kind,
        retryable,
      });
    },
  );
});
