import {
  FamilyMember,
  type CreateFamilyMemberInput,
} from "@family-finance/domain";
import type {
  FamilyMemberRepository,
  FamilyProfileRepository,
} from "../ports/family-repositories.js";

export interface MemberReferenceChecker {
  hasReferences(familyId: string, memberId: string): Promise<boolean>;
}

export class CannotRemoveReferencedMemberError extends Error {
  public constructor(memberId: string) {
    super(
      `Family member ${memberId} cannot be removed while plans reference it`,
    );
    this.name = "CannotRemoveReferencedMemberError";
  }
}

export class FamilyMemberService {
  public constructor(
    private readonly families: FamilyProfileRepository,
    private readonly members: FamilyMemberRepository,
    private readonly references: MemberReferenceChecker,
  ) {}

  public async add(input: CreateFamilyMemberInput): Promise<FamilyMember> {
    await this.families.getById(input.familyId);
    const member = FamilyMember.create(input);
    await this.members.create(member);
    return member;
  }

  public list(familyId: string): Promise<readonly FamilyMember[]> {
    return this.members.listByFamilyId(familyId);
  }

  public async edit(
    familyId: string,
    memberId: string,
    name: string,
  ): Promise<FamilyMember> {
    const member = await this.members.getById(familyId, memberId);
    const updated = member.rename(name);
    await this.members.update(updated);
    return updated;
  }

  public async remove(familyId: string, memberId: string): Promise<void> {
    await this.members.getById(familyId, memberId);
    if (await this.references.hasReferences(familyId, memberId)) {
      throw new CannotRemoveReferencedMemberError(memberId);
    }
    await this.members.remove(familyId, memberId);
  }
}
