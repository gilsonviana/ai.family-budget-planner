import type { BillPlan, DateRange, LocalDate } from "@family-finance/domain";

import type { BillPlanRepository } from "../ports/bill-repository.js";

export class BillQueryService {
  constructor(private readonly bills: BillPlanRepository) {}
  get(familyId: string, id: string): Promise<BillPlan> {
    return this.bills.getById(familyId, id);
  }
  listForReminders(
    familyId: string,
    reminderPeriod: DateRange,
    today: LocalDate,
  ): Promise<readonly BillPlan[]> {
    return this.bills.listForReminders({ familyId, reminderPeriod, today });
  }
}
