import {
  BillQueryService,
  BudgetForecastService,
  BudgetSummaryService,
  DueReminderSelectionService,
  ExpensePlanService,
  ExpenseProjectionService,
  FamilyMemberService,
  FamilyProfileService,
  IncomePlanService,
  IncomeProjectionService,
  DateRange,
  LocalDate,
  Money,
  PeriodComparisonService,
  RecurrenceRule,
  ReminderProcessingService,
  buildAnalyticalBreakdowns,
  type EmailProvider,
  type ForecastGranularity,
} from "@family-finance/application";
import type { ApplicationConfig } from "@family-finance/config";
import {
  ResendEmailProvider,
  SQLiteBillPlanRepository,
  SQLiteExpenseCategoryRepository,
  SQLiteExpensePlanRepository,
  SQLiteFamilyMemberRepository,
  SQLiteFamilyProfileRepository,
  SQLiteIncomePlanRepository,
  SQLiteReminderDeliveryRepository,
  type FinanceDatabase,
} from "@family-finance/infrastructure";

import { CliValidationError } from "./index.js";
import type {
  AdvancedCommandGateway,
  AdvancedOperation,
} from "./advanced-commands.js";
import type { CorePlanningOperation } from "./core-commands.js";

type Input = Readonly<Record<string, unknown>>;

function string(input: Input, key: string): string {
  const result = input[key];
  if (typeof result !== "string" || result.length === 0)
    throw new CliValidationError(`${key} is required`);
  return result;
}

function option(raw: readonly string[], name: string): string | undefined {
  const index = raw.indexOf(name);
  return index < 0 ? undefined : raw[index + 1];
}

function requiredOption(raw: readonly string[], name: string): string {
  const result = option(raw, name);
  if (!result) throw new CliValidationError(`${name} is required`);
  return result;
}

function record(input: Input, key: string): Input {
  const result = input[key];
  if (result === null || Array.isArray(result) || typeof result !== "object")
    throw new CliValidationError(`${key} must be an object`);
  return result as Input;
}

function planningInput(input: Input): Input {
  const result: Record<string, unknown> = { ...input };
  if (input.amount !== undefined) {
    const amount = record(input, "amount");
    result.amount = Money.fromDecimal(
      string(amount, "value"),
      string(amount, "currency"),
    );
  }
  if (input.recurrence !== undefined) {
    const recurrence = record(input, "recurrence");
    const endDate = recurrence.endDate;
    const monthOverflow = recurrence.monthOverflow;
    result.recurrence = RecurrenceRule.create({
      frequency: string(recurrence, "frequency"),
      startDate: LocalDate.fromISO(string(recurrence, "startDate")),
      ...(typeof endDate === "string"
        ? { endDate: LocalDate.fromISO(endDate) }
        : {}),
      ...(monthOverflow === "constrain" || monthOverflow === "reject"
        ? { monthOverflow }
        : {}),
    });
  }
  return result;
}

export interface FinanceCommandGateway {
  execute(
    operation: CorePlanningOperation,
    input: Input,
    databasePath: string,
  ): Promise<unknown>;
  execute(
    operation: AdvancedOperation,
    input: Parameters<AdvancedCommandGateway["execute"]>[1],
  ): Promise<unknown>;
}

/** Maps CLI operations to the application layer while keeping parsing at the adapter boundary. */
export function createFinanceCommandGateway(
  database: FinanceDatabase,
  config: ApplicationConfig,
): FinanceCommandGateway {
  const familyRepository = new SQLiteFamilyProfileRepository(database);
  const memberRepository = new SQLiteFamilyMemberRepository(database);
  const incomeRepository = new SQLiteIncomePlanRepository(database);
  const categoryRepository = new SQLiteExpenseCategoryRepository(database);
  const expenseRepository = new SQLiteExpensePlanRepository(database);
  const billRepository = new SQLiteBillPlanRepository(database);
  const deliveryRepository = new SQLiteReminderDeliveryRepository(database);

  const families = new FamilyProfileService(familyRepository);
  const incomes = new IncomePlanService(
    familyRepository,
    memberRepository,
    incomeRepository,
  );
  const members = new FamilyMemberService(familyRepository, memberRepository, {
    hasReferences: (familyId, memberId) =>
      incomes.hasMemberReferences(familyId, memberId),
  });
  const expenses = new ExpensePlanService(
    familyRepository,
    categoryRepository,
    expenseRepository,
  );
  const incomeProjections = new IncomeProjectionService(
    familyRepository,
    incomeRepository,
  );
  const expenseProjections = new ExpenseProjectionService(
    familyRepository,
    expenseRepository,
  );
  const summaries = new BudgetSummaryService(
    incomeProjections,
    expenseProjections,
  );
  const comparisons = new PeriodComparisonService(summaries);
  const forecasts = new BudgetForecastService(
    incomeProjections,
    expenseProjections,
  );
  const bills = new BillQueryService(billRepository);

  async function executeCore(
    operation: CorePlanningOperation,
    input: Input,
  ): Promise<unknown> {
    switch (operation) {
      case "family:create":
        return families.create(input as never);
      case "family:get":
        return families.get(string(input, "id"));
      case "family:update":
        return families.update(input as never);
      case "member:add":
        return members.add(input as never);
      case "member:list":
        return members.list(string(input, "familyId"));
      case "member:edit":
        return members.edit(
          string(input, "familyId"),
          string(input, "id"),
          string(input, "name"),
        );
      case "member:remove":
        await members.remove(string(input, "familyId"), string(input, "id"));
        return { removed: true };
      case "income:create":
        return incomes.create(planningInput(input) as never);
      case "income:get":
        return incomes.get(string(input, "familyId"), string(input, "id"));
      case "income:list":
        return incomes.list(input as never);
      case "income:update":
        return incomes.update(planningInput(input) as never);
      case "income:deactivate":
        return incomes.deactivate(
          string(input, "familyId"),
          string(input, "id"),
        );
      case "expense:category-create":
        return expenses.createCategory(input as never);
      case "expense:category-deactivate":
        return expenses.deactivateCategory(
          string(input, "familyId"),
          string(input, "id"),
        );
      case "expense:create":
        return expenses.create(planningInput(input) as never);
      case "expense:get":
        return expenses.get(string(input, "familyId"), string(input, "id"));
      case "expense:list":
        return expenses.list(input as never);
      case "expense:update":
        return expenses.update(planningInput(input) as never);
      case "expense:deactivate":
        return expenses.deactivate(
          string(input, "familyId"),
          string(input, "id"),
        );
    }
  }

  async function executeAdvanced(
    operation: AdvancedOperation,
    input: { databasePath: string; period: DateRange; raw: readonly string[] },
  ): Promise<unknown> {
    const familyId = requiredOption(input.raw, "--family-id");
    switch (operation) {
      case "budget:summary":
        return summaries.summarize(familyId, input.period);
      case "analytics:breakdown": {
        const [income, expense, categories, memberList] = await Promise.all([
          incomeProjections.project(familyId, input.period),
          expenseProjections.project(familyId, input.period),
          categoryRepository.list(familyId),
          memberRepository.listByFamilyId(familyId),
        ]);
        return buildAnalyticalBreakdowns(
          income,
          expense,
          categories,
          memberList,
        );
      }
      case "budget:compare": {
        const baseline = DateRange.inclusive(
          LocalDate.fromISO(requiredOption(input.raw, "--baseline-from")),
          LocalDate.fromISO(requiredOption(input.raw, "--baseline-to")),
        );
        return comparisons.compare(familyId, baseline, input.period);
      }
      case "budget:forecast": {
        const granularity = requiredOption(input.raw, "--granularity");
        if (
          !(["weekly", "monthly", "quarterly", "yearly"] as string[]).includes(
            granularity,
          )
        )
          throw new CliValidationError(
            "--granularity must be weekly, monthly, quarterly, or yearly",
          );
        return forecasts.forecast(
          familyId,
          input.period,
          granularity as ForecastGranularity,
        );
      }
      case "bill:list":
        return bills.listForReminders(
          familyId,
          input.period,
          LocalDate.fromISO(
            option(input.raw, "--today") ?? input.period.start.toString(),
          ),
        );
      case "reminder:process": {
        if (!config.email)
          throw new CliValidationError(
            "reminder:process requires FINANCE_EMAIL_PROVIDER, FINANCE_EMAIL_FROM, and FINANCE_EMAIL_API_KEY",
          );
        const selector = new DueReminderSelectionService(
          billRepository,
          deliveryRepository,
        );
        const email: EmailProvider = new ResendEmailProvider(config);
        return new ReminderProcessingService(
          selector,
          deliveryRepository,
          email,
          config.email.from,
        ).process(familyId, input.period.start, new Date().toISOString());
      }
    }
  }

  const execute = (
    operation: CorePlanningOperation | AdvancedOperation,
    input: Input | Parameters<AdvancedCommandGateway["execute"]>[1],
  ) =>
    operation.includes(":") &&
    (
      [
        "budget:summary",
        "analytics:breakdown",
        "budget:compare",
        "budget:forecast",
        "bill:list",
        "reminder:process",
      ] as string[]
    ).includes(operation)
      ? executeAdvanced(
          operation as AdvancedOperation,
          input as Parameters<AdvancedCommandGateway["execute"]>[1],
        )
      : executeCore(operation as CorePlanningOperation, input as Input);
  return { execute } as FinanceCommandGateway;
}
