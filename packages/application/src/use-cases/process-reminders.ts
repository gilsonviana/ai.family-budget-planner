import type { LocalDate } from "@family-finance/domain";

import {
  EmailProviderError,
  type EmailProvider,
} from "../ports/email-provider.js";
import type { ReminderDeliveryRepository } from "../ports/reminder-delivery-repository.js";
import type { DueReminderSelectionService } from "./due-reminders.js";

export interface ReminderProcessingItem {
  readonly billId: string;
  readonly dueDate: string;
  readonly recipient: string;
  readonly status: "failed" | "sent" | "skipped";
  readonly detail?: string;
}
export interface ReminderProcessingSummary {
  readonly attemptedAt: string;
  readonly failed: number;
  readonly items: readonly ReminderProcessingItem[];
  readonly processingDate: string;
  readonly selected: number;
  readonly sent: number;
  readonly skipped: number;
}

export class ReminderProcessingService {
  constructor(
    private readonly selector: DueReminderSelectionService,
    private readonly deliveries: ReminderDeliveryRepository,
    private readonly email: EmailProvider,
    private readonly from: string,
  ) {}

  async process(
    familyId: string,
    processingDate: LocalDate,
    attemptedAt: string,
  ): Promise<ReminderProcessingSummary> {
    const due = await this.selector.select(familyId, processingDate);
    const items: ReminderProcessingItem[] = [];
    for (const reminder of due) {
      const key = {
        billId: reminder.billId,
        dueDate: reminder.dueDate,
        recipient: reminder.recipient,
      };
      if (!(await this.deliveries.claim(key, attemptedAt))) {
        items.push({
          billId: key.billId,
          dueDate: key.dueDate.toString(),
          recipient: key.recipient,
          status: "skipped",
          detail: "already claimed or sent",
        });
        continue;
      }
      try {
        const receipt = await this.email.send({
          ...reminder,
          from: this.from,
          subject: `${reminder.billName} is due ${reminder.dueDate.toString()}`,
        });
        await this.deliveries.recordSuccess(
          key,
          attemptedAt,
          receipt.providerMessageId,
        );
        items.push({
          billId: key.billId,
          dueDate: key.dueDate.toString(),
          recipient: key.recipient,
          status: "sent",
          detail: receipt.providerMessageId,
        });
      } catch (error) {
        const kind =
          error instanceof EmailProviderError ? error.kind : "unknown";
        await this.deliveries.recordFailure(key, attemptedAt, kind);
        items.push({
          billId: key.billId,
          dueDate: key.dueDate.toString(),
          recipient: key.recipient,
          status: "failed",
          detail: kind,
        });
      }
    }
    return Object.freeze({
      attemptedAt,
      failed: items.filter((item) => item.status === "failed").length,
      items: Object.freeze(items),
      processingDate: processingDate.toString(),
      selected: due.length,
      sent: items.filter((item) => item.status === "sent").length,
      skipped: items.filter((item) => item.status === "skipped").length,
    });
  }
}
