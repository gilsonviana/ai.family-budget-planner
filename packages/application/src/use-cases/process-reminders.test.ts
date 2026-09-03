import { LocalDate, Money } from "@family-finance/domain";
import { describe, expect, it, vi } from "vitest";

import { EmailProviderError } from "../ports/email-provider.js";
import { ReminderProcessingService } from "./process-reminders.js";

const date = LocalDate.fromISO("2026-07-01");
const reminders = [
  "sent@example.com",
  "failed@example.com",
  "claimed@example.com",
].map((recipient) => ({
  amount: Money.fromDecimal("10", "USD"),
  billId: "power",
  billName: "Power",
  dueDate: date.addDays(2),
  processingDate: date,
  recipient,
}));
describe("ReminderProcessingService", () => {
  it("persists outcomes, avoids claimed duplicates, and returns an audit summary", async () => {
    const deliveries = {
      claim: vi.fn(
        async ({ recipient }) => recipient !== "claimed@example.com",
      ),
      recordFailure: vi.fn(),
      recordSuccess: vi.fn(),
      wasSuccessfullySent: vi.fn(),
    };
    const send = vi.fn(async ({ recipient }) => {
      if (recipient === "failed@example.com")
        throw new EmailProviderError("unavailable", true, "down");
      return { providerMessageId: "provider-1" };
    });
    const result = await new ReminderProcessingService(
      { select: vi.fn().mockResolvedValue(reminders) } as never,
      deliveries,
      { send },
      "budget@example.com",
    ).process("f", date, "2026-07-01T12:00:00Z");
    expect({
      failed: result.failed,
      selected: result.selected,
      sent: result.sent,
      skipped: result.skipped,
    }).toEqual({ failed: 1, selected: 3, sent: 1, skipped: 1 });
    expect(deliveries.recordSuccess).toHaveBeenCalledTimes(1);
    expect(deliveries.recordFailure).toHaveBeenCalledWith(
      expect.anything(),
      "2026-07-01T12:00:00Z",
      "unavailable",
    );
    expect(result.items).toHaveLength(3);
  });
});
