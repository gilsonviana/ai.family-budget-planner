import {
  BillPlan,
  ExpensePlan,
  LocalDate,
  Money,
  RecurrenceRule,
} from "@family-finance/domain";
import { describe, expect, it, vi } from "vitest";

import { DueReminderSelectionService } from "./due-reminders.js";

describe("DueReminderSelectionService", () => {
  it("respects recurrence and lead time and excludes sent recipients", async () => {
    const processingDate = LocalDate.fromISO("2026-04-07");
    const bill = BillPlan.create(
      ExpensePlan.create({
        amount: Money.fromDecimal("80", "USD"),
        categoryId: "utilities",
        familyId: "f",
        id: "power",
        name: "Power",
        recurrence: RecurrenceRule.monthly(LocalDate.fromISO("2026-01-10")),
      }),
      { leadDays: 3, recipients: ["sent@example.com", "due@example.com"] },
    );
    const listForReminders = vi.fn().mockResolvedValue([bill]);
    const wasSuccessfullySent = vi.fn(
      async ({ recipient }) => recipient === "sent@example.com",
    );
    const result = await new DueReminderSelectionService(
      { listForReminders } as never,
      {
        claim: vi.fn(),
        recordFailure: vi.fn(),
        recordSuccess: vi.fn(),
        wasSuccessfullySent,
      },
    ).select("f", processingDate);
    expect(result.map((item) => item.recipient)).toEqual(["due@example.com"]);
    expect(result[0]?.dueDate.toString()).toBe("2026-04-10");
    expect(listForReminders).toHaveBeenCalledWith({
      familyId: "f",
      reminderPeriod: expect.anything(),
      today: processingDate,
    });
  });
});
