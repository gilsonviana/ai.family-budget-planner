import type { BillPlan, DateRange, LocalDate } from "@family-finance/domain";

export interface BillReminderQuery {
  readonly familyId: string;
  readonly reminderPeriod: DateRange;
  readonly today: LocalDate;
}

export interface BillPlanRepository {
  /** Creates the expense, bill settings, and recipients as one atomic operation. */
  create(bill: BillPlan): Promise<void>;
  getById(familyId: string, id: string): Promise<BillPlan>;
  listForReminders(query: BillReminderQuery): Promise<readonly BillPlan[]>;
}
