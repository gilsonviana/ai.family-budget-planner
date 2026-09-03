import { describe, expect, it } from "vitest";
import { FamilyMember, InvalidFamilyMemberError } from "./member.js";

describe("FamilyMember", () => {
  it("normalizes a member while preserving stable identities", () => {
    const member = FamilyMember.create({
      familyId: "family_1",
      id: "member_1",
      name: "  Gilson   Viana ",
    });
    const renamed = member.rename("Gilson");
    expect(member.name).toBe("Gilson Viana");
    expect(renamed.familyId).toBe("family_1");
    expect(renamed.id).toBe("member_1");
    expect(renamed.name).toBe("Gilson");
  });

  it.each([
    { familyId: "", id: "member", name: "Name" },
    { familyId: "family", id: "has spaces", name: "Name" },
    { familyId: "family", id: "member", name: " " },
  ])("rejects invalid member input %#", (input) => {
    expect(() => FamilyMember.create(input)).toThrowError(
      InvalidFamilyMemberError,
    );
  });
});
