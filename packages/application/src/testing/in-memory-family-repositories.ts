import type { FamilyMember, FamilyProfile } from "@family-finance/domain";

import {
  RepositoryConflictError,
  RepositoryNotFoundError,
  type FamilyMemberRepository,
  type FamilyProfileRepository,
} from "../ports/family-repositories.js";

export class InMemoryFamilyProfileRepository implements FamilyProfileRepository {
  readonly #profiles = new Map<string, FamilyProfile>();

  public async create(profile: FamilyProfile): Promise<void> {
    if (this.#profiles.has(profile.id)) {
      throw new RepositoryConflictError("family", profile.id);
    }
    this.#profiles.set(profile.id, profile);
  }

  public async findById(id: string): Promise<FamilyProfile | null> {
    return this.#profiles.get(id) ?? null;
  }

  public async getById(id: string): Promise<FamilyProfile> {
    const profile = await this.findById(id);
    if (profile === null) {
      throw new RepositoryNotFoundError("family", id);
    }
    return profile;
  }

  public async update(profile: FamilyProfile): Promise<void> {
    if (!this.#profiles.has(profile.id)) {
      throw new RepositoryNotFoundError("family", profile.id);
    }
    this.#profiles.set(profile.id, profile);
  }
}

function memberKey(familyId: string, id: string): string {
  return `${familyId}\u0000${id}`;
}

export class InMemoryFamilyMemberRepository implements FamilyMemberRepository {
  readonly #members = new Map<string, FamilyMember>();

  public async create(member: FamilyMember): Promise<void> {
    const key = memberKey(member.familyId, member.id);
    if (this.#members.has(key)) {
      throw new RepositoryConflictError("familyMember", member.id);
    }
    this.#members.set(key, member);
  }

  public async findById(
    familyId: string,
    id: string,
  ): Promise<FamilyMember | null> {
    return this.#members.get(memberKey(familyId, id)) ?? null;
  }

  public async getById(familyId: string, id: string): Promise<FamilyMember> {
    const member = await this.findById(familyId, id);
    if (member === null) {
      throw new RepositoryNotFoundError("familyMember", id);
    }
    return member;
  }

  public async listByFamilyId(
    familyId: string,
  ): Promise<readonly FamilyMember[]> {
    return [...this.#members.values()]
      .filter((member) => member.familyId === familyId)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  public async remove(familyId: string, id: string): Promise<void> {
    if (!this.#members.delete(memberKey(familyId, id))) {
      throw new RepositoryNotFoundError("familyMember", id);
    }
  }

  public async update(member: FamilyMember): Promise<void> {
    const key = memberKey(member.familyId, member.id);
    if (!this.#members.has(key)) {
      throw new RepositoryNotFoundError("familyMember", member.id);
    }
    this.#members.set(key, member);
  }
}
