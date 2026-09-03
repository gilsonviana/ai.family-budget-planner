import type {
  ReminderDeliveryRepository,
  ReminderOccurrenceKey,
} from "@family-finance/application";
import { and, eq } from "drizzle-orm";

import type { FinanceDatabase } from "./database.js";
import { reminderDeliveries } from "./schema.js";

function predicate(key: ReminderOccurrenceKey) {
  return and(
    eq(reminderDeliveries.billPlanId, key.billId),
    eq(reminderDeliveries.dueDate, key.dueDate.toString()),
    eq(reminderDeliveries.recipient, key.recipient),
  );
}

export class SQLiteReminderDeliveryRepository implements ReminderDeliveryRepository {
  constructor(private readonly database: FinanceDatabase) {}

  async claim(
    key: ReminderOccurrenceKey,
    attemptedAt: string,
  ): Promise<boolean> {
    return this.database.transaction((transaction) => {
      const existing = transaction
        .select()
        .from(reminderDeliveries)
        .where(predicate(key))
        .get();
      if (existing && existing.status !== "failed") return false;
      if (existing) {
        transaction
          .update(reminderDeliveries)
          .set({ attemptedAt, failureKind: null, status: "claimed" })
          .where(predicate(key))
          .run();
      } else {
        transaction
          .insert(reminderDeliveries)
          .values({
            attemptedAt,
            billPlanId: key.billId,
            dueDate: key.dueDate.toString(),
            recipient: key.recipient,
            status: "claimed",
          })
          .run();
      }
      return true;
    });
  }

  async recordFailure(
    key: ReminderOccurrenceKey,
    attemptedAt: string,
    failureKind: string,
  ): Promise<void> {
    this.database
      .update(reminderDeliveries)
      .set({
        attemptedAt,
        failureKind,
        providerMessageId: null,
        status: "failed",
      })
      .where(predicate(key))
      .run();
  }
  async recordSuccess(
    key: ReminderOccurrenceKey,
    attemptedAt: string,
    providerMessageId: string,
  ): Promise<void> {
    this.database
      .update(reminderDeliveries)
      .set({
        attemptedAt,
        failureKind: null,
        providerMessageId,
        status: "succeeded",
      })
      .where(predicate(key))
      .run();
  }
  async wasSuccessfullySent(key: ReminderOccurrenceKey): Promise<boolean> {
    return (
      this.database
        .select({ status: reminderDeliveries.status })
        .from(reminderDeliveries)
        .where(predicate(key))
        .get()?.status === "succeeded"
    );
  }
}
