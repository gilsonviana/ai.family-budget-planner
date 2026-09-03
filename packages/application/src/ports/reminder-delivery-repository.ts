import type { LocalDate } from "@family-finance/domain";

export interface ReminderOccurrenceKey {
  readonly billId: string;
  readonly dueDate: LocalDate;
  readonly recipient: string;
}

export interface ReminderDeliveryRepository {
  wasSuccessfullySent(key: ReminderOccurrenceKey): Promise<boolean>;
}
