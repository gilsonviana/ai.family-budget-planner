import {
  CurrencyMismatchError,
  IncomePlan,
  type CreateIncomePlanInput,
  type UpdateIncomePlanInput,
} from "@family-finance/domain";
import type {
  FamilyMemberRepository,
  FamilyProfileRepository,
} from "../ports/family-repositories.js";
import type {
  IncomePlanQuery,
  IncomePlanRepository,
} from "../ports/income-repository.js";

export interface UpdateIncomePlanCommand extends UpdateIncomePlanInput {
  readonly familyId: string;
  readonly id: string;
}

export class IncomePlanService {
  public constructor(
    private readonly families: FamilyProfileRepository,
    private readonly members: FamilyMemberRepository,
    private readonly incomes: IncomePlanRepository,
  ) {}

  public async create(input: CreateIncomePlanInput): Promise<IncomePlan> {
    await this.validateOwnerAndCurrency(
      input.familyId,
      input.memberId,
      input.amount.currency,
    );
    const plan = IncomePlan.create(input);
    await this.incomes.create(plan);
    return plan;
  }

  public get(familyId: string, id: string): Promise<IncomePlan> {
    return this.incomes.getById(familyId, id);
  }

  public list(query: IncomePlanQuery): Promise<readonly IncomePlan[]> {
    return this.incomes.list(query);
  }

  public async update(command: UpdateIncomePlanCommand): Promise<IncomePlan> {
    const existing = await this.incomes.getById(command.familyId, command.id);
    if (command.amount !== undefined) {
      await this.validateOwnerAndCurrency(
        existing.familyId,
        existing.memberId,
        command.amount.currency,
      );
    }
    const updated = existing.update(command);
    await this.incomes.update(updated);
    return updated;
  }

  public async deactivate(familyId: string, id: string): Promise<IncomePlan> {
    const plan = (await this.incomes.getById(familyId, id)).deactivate();
    await this.incomes.update(plan);
    return plan;
  }

  public async hasMemberReferences(
    familyId: string,
    memberId: string,
  ): Promise<boolean> {
    return (await this.incomes.list({ familyId, memberId })).length > 0;
  }

  private async validateOwnerAndCurrency(
    familyId: string,
    memberId: string,
    currency: string,
  ): Promise<void> {
    const family = await this.families.getById(familyId);
    await this.members.getById(familyId, memberId);
    if (family.settings.currency !== currency) {
      throw new CurrencyMismatchError(family.settings.currency, currency);
    }
  }
}
