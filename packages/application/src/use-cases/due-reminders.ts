import { DateRange, type LocalDate, type Money } from "@family-finance/domain";

import type { BillPlanRepository } from "../ports/bill-repository.js";
import type { ReminderDeliveryRepository } from "../ports/reminder-delivery-repository.js";

export interface DueReminder {
  readonly amount: Money;
  readonly billId: string;
  readonly billName: string;
  readonly dueDate: LocalDate;
  readonly processingDate: LocalDate;
  readonly recipient: string;
}

export class DueReminderSelectionService {
  constructor(
    private readonly bills: BillPlanRepository,
    private readonly deliveries: ReminderDeliveryRepository,
  ) {}

  async select(
    familyId: string,
    processingDate: LocalDate,
  ): Promise<readonly DueReminder[]> {
    const processingPeriod = DateRange.inclusive(
      processingDate,
      processingDate,
    );
    const bills = await this.bills.listForReminders({
      familyId,
      reminderPeriod: processingPeriod,
      today: processingDate,
    });
    const selected: DueReminder[] = [];
    for (const bill of bills) {
      const dueDate = processingDate.addDays(bill.reminders.leadDays);
      if (
        !bill.expense.recurrence.occurrencesIn(
          DateRange.inclusive(dueDate, dueDate),
        ).length
      )
        continue;
      for (const recipient of bill.reminders.recipients) {
        const key = { billId: bill.expense.id, dueDate, recipient };
        if (!(await this.deliveries.wasSuccessfullySent(key))) {
          selected.push(
            Object.freeze({
              amount: bill.expense.amount,
              billId: bill.expense.id,
              billName: bill.expense.name,
              dueDate,
              processingDate,
              recipient,
            }),
          );
        }
      }
    }
    return Object.freeze(selected);
  }
}
