import type { LocalDate } from "@family-finance/domain";

export interface ReminderOccurrenceKey {
  readonly billId: string;
  readonly dueDate: LocalDate;
  readonly recipient: string;
}

export interface ReminderDeliveryRepository {
  claim(key: ReminderOccurrenceKey, attemptedAt: string): Promise<boolean>;
  recordFailure(
    key: ReminderOccurrenceKey,
    attemptedAt: string,
    failureKind: string,
  ): Promise<void>;
  recordSuccess(
    key: ReminderOccurrenceKey,
    attemptedAt: string,
    providerMessageId: string,
  ): Promise<void>;
  wasSuccessfullySent(key: ReminderOccurrenceKey): Promise<boolean>;
}
