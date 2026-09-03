import {
  RepositoryConflictError,
  RepositoryNotFoundError,
  type BillPlanRepository,
  type BillReminderQuery,
  type ExpenseCategoryRepository,
  type ExpensePlanQuery,
  type ExpensePlanRepository,
  type FamilyMemberRepository,
  type FamilyProfileRepository,
  type IncomePlanQuery,
  type IncomePlanRepository,
} from "@family-finance/application";
import {
  BillPlan,
  BillReminderPreferences,
  DateRange,
  ExpenseCategory,
  ExpensePlan,
  FamilyMember,
  FamilyProfile,
  IncomePlan,
  LocalDate,
  Money,
  RecurrenceRule,
  type RecurrenceFrequency,
} from "@family-finance/domain";
import { and, eq } from "drizzle-orm";

import type { FinanceDatabase } from "./database.js";
import {
  billPlans,
  billReminderRecipients,
  expenseCategories,
  expensePlans,
  familyMembers,
  households,
  incomePlans,
} from "./schema.js";

type RecurrenceRow = {
  recurrenceEndDate: string | null;
  recurrenceFrequency: string;
  recurrenceMonthOverflow: "constrain" | "reject";
  recurrenceStartDate: string;
};
type MoneyRow = {
  amountCurrency: string;
  amountFractionDigits: number;
  amountMinorUnits: string;
};

function recurrence(row: RecurrenceRow): RecurrenceRule {
  return RecurrenceRule.create({
    ...(row.recurrenceEndDate
      ? { endDate: LocalDate.fromISO(row.recurrenceEndDate) }
      : {}),
    frequency: row.recurrenceFrequency as RecurrenceFrequency,
    monthOverflow: row.recurrenceMonthOverflow,
    startDate: LocalDate.fromISO(row.recurrenceStartDate),
  });
}

function money(row: MoneyRow): Money {
  return Money.fromMinorUnits(
    BigInt(row.amountMinorUnits),
    row.amountCurrency,
    {
      fractionDigits: row.amountFractionDigits,
    },
  );
}

function recurrenceValues(value: RecurrenceRule) {
  return {
    recurrenceEndDate: value.endDate?.toString() ?? null,
    recurrenceFrequency: value.frequency,
    recurrenceMonthOverflow: value.monthOverflow,
    recurrenceStartDate: value.startDate.toString(),
  };
}

function moneyValues(value: Money) {
  return {
    amountCurrency: value.currency,
    amountFractionDigits: value.fractionDigits,
    amountMinorUnits: value.minorUnits.toString(),
  };
}

function overlapsPeriod(
  rule: RecurrenceRule,
  period: DateRange | undefined,
): boolean {
  return period === undefined || rule.occurrencesIn(period).length > 0;
}

function isConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    String(error.code).startsWith("SQLITE_CONSTRAINT")
  );
}

async function translateConflict(
  operation: () => void,
  entity: ConstructorParameters<typeof RepositoryConflictError>[0],
  id: string,
): Promise<void> {
  try {
    operation();
  } catch (error) {
    if (isConstraintError(error)) throw new RepositoryConflictError(entity, id);
    throw error;
  }
}

export class SQLiteFamilyProfileRepository implements FamilyProfileRepository {
  constructor(private readonly database: FinanceDatabase) {}

  async create(profile: FamilyProfile): Promise<void> {
    await translateConflict(
      () => {
        this.database
          .insert(households)
          .values({
            currency: profile.settings.currency,
            id: profile.id,
            locale: profile.settings.locale,
            name: profile.name,
            timeZone: profile.settings.timeZone,
            weekStartsOn: profile.settings.weekStartsOn,
          })
          .run();
      },
      "family",
      profile.id,
    );
  }

  async findById(id: string): Promise<FamilyProfile | null> {
    const row = this.database
      .select()
      .from(households)
      .where(eq(households.id, id))
      .get();
    return row
      ? FamilyProfile.create({
          id: row.id,
          name: row.name,
          settings: {
            currency: row.currency,
            locale: row.locale,
            timeZone: row.timeZone,
            weekStartsOn: row.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          },
        })
      : null;
  }

  async getById(id: string): Promise<FamilyProfile> {
    const result = await this.findById(id);
    if (!result) throw new RepositoryNotFoundError("family", id);
    return result;
  }

  async update(profile: FamilyProfile): Promise<void> {
    const result = this.database
      .update(households)
      .set({
        currency: profile.settings.currency,
        locale: profile.settings.locale,
        name: profile.name,
        timeZone: profile.settings.timeZone,
        weekStartsOn: profile.settings.weekStartsOn,
      })
      .where(eq(households.id, profile.id))
      .run();
    if (result.changes === 0)
      throw new RepositoryNotFoundError("family", profile.id);
  }
}

export class SQLiteFamilyMemberRepository implements FamilyMemberRepository {
  constructor(private readonly database: FinanceDatabase) {}

  async create(member: FamilyMember): Promise<void> {
    await translateConflict(
      () => {
        this.database.insert(familyMembers).values(member).run();
      },
      "familyMember",
      member.id,
    );
  }

  async findById(familyId: string, id: string): Promise<FamilyMember | null> {
    const row = this.database
      .select()
      .from(familyMembers)
      .where(
        and(eq(familyMembers.familyId, familyId), eq(familyMembers.id, id)),
      )
      .get();
    return row ? FamilyMember.create(row) : null;
  }

  async getById(familyId: string, id: string): Promise<FamilyMember> {
    const result = await this.findById(familyId, id);
    if (!result) throw new RepositoryNotFoundError("familyMember", id);
    return result;
  }

  async listByFamilyId(familyId: string): Promise<readonly FamilyMember[]> {
    return this.database
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.familyId, familyId))
      .all()
      .map(FamilyMember.create);
  }

  async remove(familyId: string, id: string): Promise<void> {
    const result = this.database
      .delete(familyMembers)
      .where(
        and(eq(familyMembers.familyId, familyId), eq(familyMembers.id, id)),
      )
      .run();
    if (result.changes === 0)
      throw new RepositoryNotFoundError("familyMember", id);
  }

  async update(member: FamilyMember): Promise<void> {
    const result = this.database
      .update(familyMembers)
      .set({ name: member.name })
      .where(
        and(
          eq(familyMembers.familyId, member.familyId),
          eq(familyMembers.id, member.id),
        ),
      )
      .run();
    if (result.changes === 0)
      throw new RepositoryNotFoundError("familyMember", member.id);
  }
}

function incomeFromRow(row: typeof incomePlans.$inferSelect): IncomePlan {
  return IncomePlan.create({
    active: row.active,
    amount: money(row),
    familyId: row.familyId,
    id: row.id,
    memberId: row.memberId,
    recurrence: recurrence(row),
    source: row.source,
  });
}

export class SQLiteIncomePlanRepository implements IncomePlanRepository {
  constructor(private readonly database: FinanceDatabase) {}

  async create(plan: IncomePlan): Promise<void> {
    await translateConflict(
      () => {
        this.database
          .insert(incomePlans)
          .values({
            ...plan,
            ...moneyValues(plan.amount),
            ...recurrenceValues(plan.recurrence),
          })
          .run();
      },
      "incomePlan",
      plan.id,
    );
  }

  async findById(familyId: string, id: string): Promise<IncomePlan | null> {
    const row = this.database
      .select()
      .from(incomePlans)
      .where(and(eq(incomePlans.familyId, familyId), eq(incomePlans.id, id)))
      .get();
    return row ? incomeFromRow(row) : null;
  }

  async getById(familyId: string, id: string): Promise<IncomePlan> {
    const result = await this.findById(familyId, id);
    if (!result) throw new RepositoryNotFoundError("incomePlan", id);
    return result;
  }

  async list(query: IncomePlanQuery): Promise<readonly IncomePlan[]> {
    return this.database
      .select()
      .from(incomePlans)
      .where(eq(incomePlans.familyId, query.familyId))
      .all()
      .map(incomeFromRow)
      .filter(
        (plan) =>
          (query.active === undefined || plan.active === query.active) &&
          (query.memberId === undefined || plan.memberId === query.memberId) &&
          overlapsPeriod(plan.recurrence, query.period),
      );
  }

  async update(plan: IncomePlan): Promise<void> {
    const result = this.database
      .update(incomePlans)
      .set({
        active: plan.active,
        memberId: plan.memberId,
        source: plan.source,
        ...moneyValues(plan.amount),
        ...recurrenceValues(plan.recurrence),
      })
      .where(
        and(
          eq(incomePlans.familyId, plan.familyId),
          eq(incomePlans.id, plan.id),
        ),
      )
      .run();
    if (result.changes === 0)
      throw new RepositoryNotFoundError("incomePlan", plan.id);
  }
}

function categoryFromRow(
  row: typeof expenseCategories.$inferSelect,
): ExpenseCategory {
  return ExpenseCategory.create(row);
}
function expenseFromRow(row: typeof expensePlans.$inferSelect): ExpensePlan {
  return ExpensePlan.create({
    active: row.active,
    amount: money(row),
    categoryId: row.categoryId,
    familyId: row.familyId,
    id: row.id,
    name: row.name,
    recurrence: recurrence(row),
  });
}

export class SQLiteExpenseCategoryRepository implements ExpenseCategoryRepository {
  constructor(private readonly database: FinanceDatabase) {}
  async create(category: ExpenseCategory): Promise<void> {
    await translateConflict(
      () => {
        this.database.insert(expenseCategories).values(category).run();
      },
      "expenseCategory",
      category.id,
    );
  }
  async getById(familyId: string, id: string): Promise<ExpenseCategory> {
    const row = this.database
      .select()
      .from(expenseCategories)
      .where(
        and(
          eq(expenseCategories.familyId, familyId),
          eq(expenseCategories.id, id),
        ),
      )
      .get();
    if (!row) throw new RepositoryNotFoundError("expenseCategory", id);
    return categoryFromRow(row);
  }
  async list(familyId: string): Promise<readonly ExpenseCategory[]> {
    return this.database
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.familyId, familyId))
      .all()
      .map(categoryFromRow);
  }
  async update(category: ExpenseCategory): Promise<void> {
    const result = this.database
      .update(expenseCategories)
      .set({ active: category.active, name: category.name })
      .where(
        and(
          eq(expenseCategories.familyId, category.familyId),
          eq(expenseCategories.id, category.id),
        ),
      )
      .run();
    if (result.changes === 0)
      throw new RepositoryNotFoundError("expenseCategory", category.id);
  }
}

export class SQLiteExpensePlanRepository implements ExpensePlanRepository {
  constructor(private readonly database: FinanceDatabase) {}
  async create(plan: ExpensePlan): Promise<void> {
    await translateConflict(
      () => {
        this.database
          .insert(expensePlans)
          .values({
            ...plan,
            ...moneyValues(plan.amount),
            ...recurrenceValues(plan.recurrence),
          })
          .run();
      },
      "expensePlan",
      plan.id,
    );
  }
  async getById(familyId: string, id: string): Promise<ExpensePlan> {
    const row = this.database
      .select()
      .from(expensePlans)
      .where(and(eq(expensePlans.familyId, familyId), eq(expensePlans.id, id)))
      .get();
    if (!row) throw new RepositoryNotFoundError("expensePlan", id);
    return expenseFromRow(row);
  }
  async list(query: ExpensePlanQuery): Promise<readonly ExpensePlan[]> {
    return this.database
      .select()
      .from(expensePlans)
      .where(eq(expensePlans.familyId, query.familyId))
      .all()
      .map(expenseFromRow)
      .filter(
        (plan) =>
          (query.active === undefined || plan.active === query.active) &&
          (query.categoryId === undefined ||
            plan.categoryId === query.categoryId) &&
          overlapsPeriod(plan.recurrence, query.period),
      );
  }
  async update(plan: ExpensePlan): Promise<void> {
    const result = this.database
      .update(expensePlans)
      .set({
        active: plan.active,
        categoryId: plan.categoryId,
        name: plan.name,
        ...moneyValues(plan.amount),
        ...recurrenceValues(plan.recurrence),
      })
      .where(
        and(
          eq(expensePlans.familyId, plan.familyId),
          eq(expensePlans.id, plan.id),
        ),
      )
      .run();
    if (result.changes === 0)
      throw new RepositoryNotFoundError("expensePlan", plan.id);
  }
}

export class SQLiteBillPlanRepository implements BillPlanRepository {
  constructor(private readonly database: FinanceDatabase) {}

  async create(bill: BillPlan): Promise<void> {
    await translateConflict(
      () => {
        this.database.transaction((transaction) => {
          transaction
            .insert(expensePlans)
            .values({
              ...bill.expense,
              ...moneyValues(bill.expense.amount),
              ...recurrenceValues(bill.expense.recurrence),
            })
            .run();
          transaction
            .insert(billPlans)
            .values({
              expensePlanId: bill.expense.id,
              reminderLeadDays: bill.reminders.leadDays,
              remindersEnabled: bill.reminders.enabled,
            })
            .run();
          if (bill.reminders.recipients.length > 0) {
            transaction
              .insert(billReminderRecipients)
              .values(
                bill.reminders.recipients.map((email) => ({
                  billPlanId: bill.expense.id,
                  email,
                })),
              )
              .run();
          }
        });
      },
      "billPlan",
      bill.expense.id,
    );
  }

  async getById(familyId: string, id: string): Promise<BillPlan> {
    const expenseRow = this.database
      .select()
      .from(expensePlans)
      .where(and(eq(expensePlans.familyId, familyId), eq(expensePlans.id, id)))
      .get();
    const billRow = this.database
      .select()
      .from(billPlans)
      .where(eq(billPlans.expensePlanId, id))
      .get();
    if (!expenseRow || !billRow)
      throw new RepositoryNotFoundError("billPlan", id);
    const recipients = this.database
      .select()
      .from(billReminderRecipients)
      .where(eq(billReminderRecipients.billPlanId, id))
      .all()
      .map((row) => row.email);
    return BillPlan.create(
      expenseFromRow(expenseRow),
      BillReminderPreferences.create({
        enabled: billRow.remindersEnabled,
        leadDays: billRow.reminderLeadDays,
        recipients,
      }),
    );
  }

  async listForReminders(
    query: BillReminderQuery,
  ): Promise<readonly BillPlan[]> {
    const rows = this.database
      .select({
        id: billPlans.expensePlanId,
        leadDays: billPlans.reminderLeadDays,
      })
      .from(billPlans)
      .innerJoin(expensePlans, eq(expensePlans.id, billPlans.expensePlanId))
      .where(
        and(
          eq(expensePlans.familyId, query.familyId),
          eq(expensePlans.active, true),
          eq(billPlans.remindersEnabled, true),
        ),
      )
      .all();
    const results: BillPlan[] = [];
    for (const row of rows) {
      const bill = await this.getById(query.familyId, row.id);
      const duePeriod = DateRange.halfOpen(
        query.reminderPeriod.start.addDays(row.leadDays),
        query.reminderPeriod.endExclusive.addDays(row.leadDays),
      );
      if (
        bill
          .occurrencesIn(duePeriod, query.today)
          .some((occurrence) =>
            query.reminderPeriod.contains(occurrence.reminderDate),
          )
      ) {
        results.push(bill);
      }
    }
    return results;
  }
}
