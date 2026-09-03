import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  BillPlan,
  DateRange,
  ExpenseCategory,
  ExpensePlan,
  FamilyMember,
  FamilyProfile,
  IncomePlan,
  LocalDate,
  Money,
  RecurrenceRule,
} from "@family-finance/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initializeDatabase, type InitializedDatabase } from "./database.js";
import {
  SQLiteBillPlanRepository,
  SQLiteExpenseCategoryRepository,
  SQLiteExpensePlanRepository,
  SQLiteFamilyMemberRepository,
  SQLiteFamilyProfileRepository,
  SQLiteIncomePlanRepository,
} from "./repositories.js";

const directories: string[] = [];
let initialized: InitializedDatabase;

beforeEach(() => {
  const directory = mkdtempSync(join(tmpdir(), "family-finance-repositories-"));
  directories.push(directory);
  initialized = initializeDatabase(
    join(directory, "finance.sqlite"),
    resolve(import.meta.dirname, "../../drizzle"),
  );
});
afterEach(() => {
  initialized.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true });
});

async function seedHousehold(): Promise<void> {
  await new SQLiteFamilyProfileRepository(initialized.database).create(
    FamilyProfile.create({
      id: "family",
      name: "Viana Family",
      settings: {
        currency: "BRL",
        locale: "pt-BR",
        timeZone: "America/Sao_Paulo",
        weekStartsOn: 1,
      },
    }),
  );
}

describe("SQLite repository contracts", () => {
  it("round-trips profiles and family-scoped members", async () => {
    const profiles = new SQLiteFamilyProfileRepository(initialized.database);
    const members = new SQLiteFamilyMemberRepository(initialized.database);
    await seedHousehold();
    await members.create(
      FamilyMember.create({ familyId: "family", id: "alex", name: "Alex" }),
    );

    expect((await profiles.getById("family")).settings.currency).toBe("BRL");
    expect(
      (await members.listByFamilyId("family")).map((member) => member.id),
    ).toEqual(["alex"]);
    await members.update(
      (await members.getById("family", "alex")).rename("Alex Viana"),
    );
    expect((await members.getById("family", "alex")).name).toBe("Alex Viana");
  });

  it("round-trips lossless income and supports projection period queries", async () => {
    await seedHousehold();
    await new SQLiteFamilyMemberRepository(initialized.database).create(
      FamilyMember.create({ familyId: "family", id: "alex", name: "Alex" }),
    );
    const incomes = new SQLiteIncomePlanRepository(initialized.database);
    await incomes.create(
      IncomePlan.create({
        amount: Money.fromMinorUnits(123456789012345678901234567890n, "BRL", {
          fractionDigits: 4,
        }),
        familyId: "family",
        id: "salary",
        memberId: "alex",
        recurrence: RecurrenceRule.monthly(LocalDate.fromISO("2026-01-31")),
        source: "Salary",
      }),
    );

    const result = await incomes.list({
      active: true,
      familyId: "family",
      period: DateRange.inclusive(
        LocalDate.fromISO("2026-02-01"),
        LocalDate.fromISO("2026-02-28"),
      ),
    });
    expect(result[0]?.amount.minorUnits).toBe(123456789012345678901234567890n);
    expect(result[0]?.amount.fractionDigits).toBe(4);
  });

  it("round-trips categories and filters expense plans for reminder/projection periods", async () => {
    await seedHousehold();
    const categories = new SQLiteExpenseCategoryRepository(
      initialized.database,
    );
    const expenses = new SQLiteExpensePlanRepository(initialized.database);
    await categories.create(
      ExpenseCategory.create({
        familyId: "family",
        id: "housing",
        name: "Housing",
      }),
    );
    await expenses.create(
      ExpensePlan.create({
        amount: Money.fromDecimal("2500", "BRL"),
        categoryId: "housing",
        familyId: "family",
        id: "rent",
        name: "Rent",
        recurrence: RecurrenceRule.monthly(LocalDate.fromISO("2026-01-05")),
      }),
    );

    expect(
      await expenses.list({
        familyId: "family",
        period: DateRange.inclusive(
          LocalDate.fromISO("2026-03-01"),
          LocalDate.fromISO("2026-03-31"),
        ),
      }),
    ).toHaveLength(1);
    expect((await categories.getById("family", "housing")).name).toBe(
      "Housing",
    );
  });

  it("atomically stores bills and queries reminders by reminder date", async () => {
    await seedHousehold();
    await new SQLiteExpenseCategoryRepository(initialized.database).create(
      ExpenseCategory.create({
        familyId: "family",
        id: "utilities",
        name: "Utilities",
      }),
    );
    const bills = new SQLiteBillPlanRepository(initialized.database);
    await bills.create(
      BillPlan.create(
        ExpensePlan.create({
          amount: Money.fromDecimal("200", "BRL"),
          categoryId: "utilities",
          familyId: "family",
          id: "power",
          name: "Power",
          recurrence: RecurrenceRule.monthly(LocalDate.fromISO("2026-03-10")),
        }),
        { leadDays: 3, recipients: ["family@example.com"] },
      ),
    );

    expect(
      await bills.listForReminders({
        familyId: "family",
        reminderPeriod: DateRange.inclusive(
          LocalDate.fromISO("2026-03-07"),
          LocalDate.fromISO("2026-03-07"),
        ),
        today: LocalDate.fromISO("2026-03-01"),
      }),
    ).toHaveLength(1);
    expect(
      (await bills.getById("family", "power")).reminders.recipients,
    ).toEqual(["family@example.com"]);
  });
});
