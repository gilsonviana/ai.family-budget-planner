import { InvalidMoneyError, Money } from "./money.js";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface HouseholdSettingsInput {
  readonly currency: string;
  readonly locale: string;
  readonly timeZone: string;
  readonly weekStartsOn: Weekday;
}

export interface CreateFamilyProfileInput {
  readonly id: string;
  readonly name: string;
  readonly settings: HouseholdSettings | HouseholdSettingsInput;
}

export class InvalidFamilyProfileError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidFamilyProfileError";
  }
}

const FAMILY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const MAX_FAMILY_NAME_LENGTH = 120;

function normalizeFamilyId(id: string): string {
  const normalized = id.trim();
  if (!FAMILY_ID_PATTERN.test(normalized)) {
    throw new InvalidFamilyProfileError(
      "Family identity must contain 1-128 letters, numbers, underscores, or hyphens",
    );
  }
  return normalized;
}

function normalizeFamilyName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (normalized.length === 0 || normalized.length > MAX_FAMILY_NAME_LENGTH) {
    throw new InvalidFamilyProfileError(
      `Family name must contain 1-${MAX_FAMILY_NAME_LENGTH} characters`,
    );
  }
  if (/\p{Cc}/u.test(normalized)) {
    throw new InvalidFamilyProfileError(
      "Family name must not contain control characters",
    );
  }
  return normalized;
}

function normalizeLocale(locale: string): string {
  try {
    return new Intl.Locale(locale.trim()).toString();
  } catch {
    throw new InvalidFamilyProfileError(
      `Invalid locale: ${JSON.stringify(locale)}`,
    );
  }
}

function normalizeTimeZone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      timeZone: timeZone.trim(),
    }).resolvedOptions().timeZone;
  } catch {
    throw new InvalidFamilyProfileError(
      `Invalid time zone: ${JSON.stringify(timeZone)}`,
    );
  }
}

function normalizeCurrency(currency: string): string {
  try {
    return Money.zero(currency).currency;
  } catch (error) {
    if (error instanceof InvalidMoneyError) {
      throw new InvalidFamilyProfileError(error.message);
    }
    throw error;
  }
}

export class HouseholdSettings {
  public readonly currency: string;
  public readonly locale: string;
  public readonly timeZone: string;
  public readonly weekStartsOn: Weekday;

  private constructor(
    currency: string,
    locale: string,
    timeZone: string,
    weekStartsOn: Weekday,
  ) {
    this.currency = currency;
    this.locale = locale;
    this.timeZone = timeZone;
    this.weekStartsOn = weekStartsOn;
    Object.freeze(this);
  }

  public static create(input: HouseholdSettingsInput): HouseholdSettings {
    if (
      !Number.isInteger(input.weekStartsOn) ||
      input.weekStartsOn < 0 ||
      input.weekStartsOn > 6
    ) {
      throw new InvalidFamilyProfileError(
        "First day of week must be an integer from 0 (Sunday) through 6 (Saturday)",
      );
    }
    return new HouseholdSettings(
      normalizeCurrency(input.currency),
      normalizeLocale(input.locale),
      normalizeTimeZone(input.timeZone),
      input.weekStartsOn,
    );
  }

  public equals(other: HouseholdSettings): boolean {
    return (
      this.currency === other.currency &&
      this.locale === other.locale &&
      this.timeZone === other.timeZone &&
      this.weekStartsOn === other.weekStartsOn
    );
  }
}

export class FamilyProfile {
  public readonly id: string;
  public readonly name: string;
  public readonly settings: HouseholdSettings;

  private constructor(id: string, name: string, settings: HouseholdSettings) {
    this.id = id;
    this.name = name;
    this.settings = settings;
    Object.freeze(this);
  }

  public static create(input: CreateFamilyProfileInput): FamilyProfile {
    return new FamilyProfile(
      normalizeFamilyId(input.id),
      normalizeFamilyName(input.name),
      input.settings instanceof HouseholdSettings
        ? input.settings
        : HouseholdSettings.create(input.settings),
    );
  }

  public rename(name: string): FamilyProfile {
    return new FamilyProfile(this.id, normalizeFamilyName(name), this.settings);
  }

  public withSettings(
    settings: HouseholdSettings | HouseholdSettingsInput,
  ): FamilyProfile {
    return new FamilyProfile(
      this.id,
      this.name,
      settings instanceof HouseholdSettings
        ? settings
        : HouseholdSettings.create(settings),
    );
  }
}
