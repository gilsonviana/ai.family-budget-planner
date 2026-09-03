import {
  FamilyProfile,
  type CreateFamilyProfileInput,
  type HouseholdSettings,
  type HouseholdSettingsInput,
} from "@family-finance/domain";

import type { FamilyProfileRepository } from "../ports/family-repositories.js";

export interface UpdateFamilyProfileInput {
  readonly id: string;
  readonly name?: string;
  readonly settings?: HouseholdSettings | HouseholdSettingsInput;
}

export class InvalidFamilyProfileCommandError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidFamilyProfileCommandError";
  }
}

export class FamilyProfileService {
  public constructor(private readonly repository: FamilyProfileRepository) {}

  public async create(input: CreateFamilyProfileInput): Promise<FamilyProfile> {
    const profile = FamilyProfile.create(input);
    await this.repository.create(profile);
    return profile;
  }

  public get(id: string): Promise<FamilyProfile> {
    return this.repository.getById(id);
  }

  public async update(input: UpdateFamilyProfileInput): Promise<FamilyProfile> {
    if (input.name === undefined && input.settings === undefined) {
      throw new InvalidFamilyProfileCommandError(
        "A family profile update must change a name or settings",
      );
    }

    let profile = await this.repository.getById(input.id);
    if (input.name !== undefined) {
      profile = profile.rename(input.name);
    }
    if (input.settings !== undefined) {
      profile = profile.withSettings(input.settings);
    }
    await this.repository.update(profile);
    return profile;
  }
}
