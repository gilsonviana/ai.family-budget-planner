export interface CreateFamilyMemberInput {
  readonly familyId: string;
  readonly id: string;
  readonly name: string;
}

export class InvalidFamilyMemberError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidFamilyMemberError";
  }
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function identity(value: string, field: string): string {
  const normalized = value.trim();
  if (!ID_PATTERN.test(normalized)) {
    throw new InvalidFamilyMemberError(
      `${field} must contain 1-128 letters, numbers, underscores, or hyphens`,
    );
  }
  return normalized;
}

function memberName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (
    normalized.length === 0 ||
    normalized.length > 120 ||
    /\p{Cc}/u.test(normalized)
  ) {
    throw new InvalidFamilyMemberError(
      "Member name must contain 1-120 visible characters",
    );
  }
  return normalized;
}

export class FamilyMember {
  public readonly familyId: string;
  public readonly id: string;
  public readonly name: string;

  private constructor(familyId: string, id: string, name: string) {
    this.familyId = familyId;
    this.id = id;
    this.name = name;
    Object.freeze(this);
  }

  public static create(input: CreateFamilyMemberInput): FamilyMember {
    return new FamilyMember(
      identity(input.familyId, "Family identity"),
      identity(input.id, "Member identity"),
      memberName(input.name),
    );
  }

  public rename(name: string): FamilyMember {
    return new FamilyMember(this.familyId, this.id, memberName(name));
  }
}
