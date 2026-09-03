import type { FamilyProfile } from "@family-finance/domain";

export type RepositoryEntity = "family" | "familyMember";

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
export interface FamilyMemberRecord {
  readonly active: boolean;
  readonly familyId: string;
  readonly id: string;
  readonly name: string;
}

export interface FamilyMemberRepository {
  create(member: FamilyMemberRecord): Promise<void>;
  findById(familyId: string, id: string): Promise<FamilyMemberRecord | null>;
  getById(familyId: string, id: string): Promise<FamilyMemberRecord>;
  listByFamilyId(familyId: string): Promise<readonly FamilyMemberRecord[]>;
  remove(familyId: string, id: string): Promise<void>;
  update(member: FamilyMemberRecord): Promise<void>;
}
