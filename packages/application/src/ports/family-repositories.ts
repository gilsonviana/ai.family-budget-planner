import type { FamilyMember, FamilyProfile } from "@family-finance/domain";

export type RepositoryEntity =
  | "billPlan"
  | "expenseCategory"
  | "expensePlan"
  | "family"
  | "familyMember"
  | "incomePlan";

export class RepositoryNotFoundError extends Error {
  public readonly entity: RepositoryEntity;
  public readonly id: string;

  public constructor(entity: RepositoryEntity, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = "RepositoryNotFoundError";
    this.entity = entity;
    this.id = id;
  }
}

export class RepositoryConflictError extends Error {
  public readonly entity: RepositoryEntity;
  public readonly id: string;

  public constructor(entity: RepositoryEntity, id: string) {
    super(`${entity} already exists: ${id}`);
    this.name = "RepositoryConflictError";
    this.entity = entity;
    this.id = id;
  }
}

export interface FamilyProfileRepository {
  create(profile: FamilyProfile): Promise<void>;
  findById(id: string): Promise<FamilyProfile | null>;
  getById(id: string): Promise<FamilyProfile>;
  update(profile: FamilyProfile): Promise<void>;
}

/**
 * Persistence shape used by member workflows until the member aggregate is
 * introduced. Repository adapters must preserve family scoping.
 */
export type FamilyMemberRecord = FamilyMember;

export interface FamilyMemberRepository {
  create(member: FamilyMember): Promise<void>;
  findById(familyId: string, id: string): Promise<FamilyMember | null>;
  getById(familyId: string, id: string): Promise<FamilyMember>;
  listByFamilyId(familyId: string): Promise<readonly FamilyMember[]>;
  remove(familyId: string, id: string): Promise<void>;
  update(member: FamilyMember): Promise<void>;
}
