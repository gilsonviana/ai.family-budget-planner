import {
  Money,
  type ExpenseCategory,
  type FamilyMember,
} from "@family-finance/domain";

import type { ExpenseProjectionResult } from "./expense-projections.js";
import type { IncomeProjectionResult } from "./income-projections.js";

export interface PercentageShare {
  /** Percentage in basis points (10000 = 100%), rounded half away from zero. */
  readonly percentageBasisPoints: number;
  readonly total: Money;
}
export interface CategoryShare extends PercentageShare {
  readonly active: boolean | null;
  readonly categoryId: string | null;
  readonly name: string;
  readonly status: "active" | "inactive" | "uncategorized";
}
export interface MemberContribution extends PercentageShare {
  readonly memberId: string;
  readonly name: string | null;
  readonly status: "known" | "missing";
}
export interface AnalyticalBreakdowns {
  readonly expensesByCategory: readonly CategoryShare[];
  readonly expenseTotal: Money;
  readonly incomeByMember: readonly MemberContribution[];
  readonly incomeTotal: Money;
}

function basisPoints(part: Money, total: Money): number {
  if (total.minorUnits === 0n) return 0;
  return Number(
    (part.minorUnits * 10_000n + total.minorUnits / 2n) / total.minorUnits,
  );
}

export function buildAnalyticalBreakdowns(
  income: IncomeProjectionResult,
  expenses: ExpenseProjectionResult,
  categories: readonly ExpenseCategory[],
  members: readonly FamilyMember[],
): AnalyticalBreakdowns {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const membersById = new Map(members.map((member) => [member.id, member]));
  const expensesByCategory = expenses.byCategory.map(
    ({ categoryId, total }) => {
      const category = categoriesById.get(categoryId);
      return Object.freeze({
        active: category?.active ?? null,
        categoryId: category?.id ?? null,
        name: category?.name ?? "Uncategorized",
        percentageBasisPoints: basisPoints(total, expenses.total),
        status: category
          ? category.active
            ? "active"
            : "inactive"
          : "uncategorized",
        total,
      } satisfies CategoryShare);
    },
  );
  const incomeByMember = income.byMember.map(({ key: memberId, total }) => {
    const member = membersById.get(memberId);
    return Object.freeze({
      memberId,
      name: member?.name ?? null,
      percentageBasisPoints: basisPoints(total, income.total),
      status: member ? "known" : "missing",
      total,
    } satisfies MemberContribution);
  });
  return Object.freeze({
    expenseTotal: expenses.total,
    expensesByCategory: Object.freeze(expensesByCategory),
    incomeByMember: Object.freeze(incomeByMember),
    incomeTotal: income.total,
  });
}
