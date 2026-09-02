export type RoundingMode = "halfAwayFromZero" | "reject";

export interface MoneyOptions {
  readonly allowNegative?: boolean;
  readonly fractionDigits?: number;
  readonly roundingMode?: RoundingMode;
}

export interface MoneyJson {
  readonly amount: string;
  readonly currency: string;
  readonly fractionDigits: number;
}

export class InvalidMoneyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InvalidMoneyError";
  }
}

export class NegativeMoneyError extends InvalidMoneyError {
  public constructor() {
    super("Negative monetary amounts are not allowed in this context");
    this.name = "NegativeMoneyError";
  }
}

export class CurrencyMismatchError extends InvalidMoneyError {
  public constructor(left: string, right: string) {
    super(`Cannot combine different currencies: ${left} and ${right}`);
    this.name = "CurrencyMismatchError";
  }
}

export class MoneyScaleMismatchError extends InvalidMoneyError {
  public constructor(left: number, right: number) {
    super(`Cannot combine amounts with different scales: ${left} and ${right}`);
    this.name = "MoneyScaleMismatchError";
  }
}

const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const DEFAULT_FRACTION_DIGITS = 2;
const MAX_FRACTION_DIGITS = 18;

function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(normalized)) {
    throw new InvalidMoneyError(
      `Currency must be a three-letter code; received ${JSON.stringify(currency)}`,
    );
  }
  return normalized;
}

function validateFractionDigits(fractionDigits: number): void {
  if (
    !Number.isInteger(fractionDigits) ||
    fractionDigits < 0 ||
    fractionDigits > MAX_FRACTION_DIGITS
  ) {
    throw new InvalidMoneyError(
      `Fraction digits must be an integer between 0 and ${MAX_FRACTION_DIGITS}`,
    );
  }
}

function parseMinorUnits(
  amount: string,
  fractionDigits: number,
  roundingMode: RoundingMode,
): bigint {
  if (typeof amount !== "string") {
    throw new InvalidMoneyError(
      "Monetary amounts must be provided as decimal strings",
    );
  }
  const match = DECIMAL_PATTERN.exec(amount);
  if (!match) {
    throw new InvalidMoneyError(
      `Amount must be a plain decimal string; received ${JSON.stringify(amount)}`,
    );
  }
  const sign = match[1] === "-" ? -1n : 1n;
  const integerPart = match[2];
  const fractionPart = match[3] ?? "";
  if (integerPart === undefined) {
    throw new InvalidMoneyError("Amount is missing an integer component");
  }
  const factor = 10n ** BigInt(fractionDigits);
  const retainedFraction = fractionPart
    .slice(0, fractionDigits)
    .padEnd(fractionDigits, "0");
  const discardedFraction = fractionPart.slice(fractionDigits);
  if (roundingMode === "reject" && /[1-9]/.test(discardedFraction)) {
    throw new InvalidMoneyError(
      `Amount ${amount} exceeds the configured scale of ${fractionDigits}`,
    );
  }
  let absoluteMinorUnits =
    BigInt(integerPart) * factor + BigInt(retainedFraction || "0");
  if (
    roundingMode === "halfAwayFromZero" &&
    discardedFraction.length > 0 &&
    Number(discardedFraction[0]) >= 5
  ) {
    absoluteMinorUnits += 1n;
  }
  return absoluteMinorUnits === 0n ? 0n : sign * absoluteMinorUnits;
}

/**
 * An immutable monetary value stored exclusively as integer minor units.
 * Signed values support differences and projected surplus/deficit; use
 * `allowNegative: false` for income and expense plan inputs.
 */
export class Money {
  public readonly currency: string;
  public readonly fractionDigits: number;
  public readonly minorUnits: bigint;

  private constructor(
    minorUnits: bigint,
    currency: string,
    fractionDigits: number,
  ) {
    this.minorUnits = minorUnits;
    this.currency = currency;
    this.fractionDigits = fractionDigits;
    Object.freeze(this);
  }

  public static fromDecimal(
    amount: string,
    currency: string,
    options: MoneyOptions = {},
  ): Money {
    const fractionDigits = options.fractionDigits ?? DEFAULT_FRACTION_DIGITS;
    const roundingMode = options.roundingMode ?? "halfAwayFromZero";
    validateFractionDigits(fractionDigits);
    const minorUnits = parseMinorUnits(amount, fractionDigits, roundingMode);
    if (options.allowNegative === false && minorUnits < 0n) {
      throw new NegativeMoneyError();
    }
    return new Money(minorUnits, normalizeCurrency(currency), fractionDigits);
  }

  public static fromMinorUnits(
    minorUnits: bigint,
    currency: string,
    options: Pick<MoneyOptions, "allowNegative" | "fractionDigits"> = {},
  ): Money {
    if (typeof minorUnits !== "bigint") {
      throw new InvalidMoneyError("Minor units must be provided as a bigint");
    }
    const fractionDigits = options.fractionDigits ?? DEFAULT_FRACTION_DIGITS;
    validateFractionDigits(fractionDigits);
    if (options.allowNegative === false && minorUnits < 0n) {
      throw new NegativeMoneyError();
    }
    return new Money(minorUnits, normalizeCurrency(currency), fractionDigits);
  }

  public static zero(
    currency: string,
    fractionDigits = DEFAULT_FRACTION_DIGITS,
  ): Money {
    return Money.fromMinorUnits(0n, currency, { fractionDigits });
  }

  public add(other: Money): Money {
    this.assertCompatible(other);
    return new Money(
      this.minorUnits + other.minorUnits,
      this.currency,
      this.fractionDigits,
    );
  }

  public subtract(other: Money): Money {
    this.assertCompatible(other);
    return new Money(
      this.minorUnits - other.minorUnits,
      this.currency,
      this.fractionDigits,
    );
  }

  public negate(): Money {
    return new Money(-this.minorUnits, this.currency, this.fractionDigits);
  }

  public equals(other: Money): boolean {
    return (
      this.currency === other.currency &&
      this.fractionDigits === other.fractionDigits &&
      this.minorUnits === other.minorUnits
    );
  }

  public isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  public toDecimal(): string {
    const sign = this.minorUnits < 0n ? "-" : "";
    const absolute = this.minorUnits < 0n ? -this.minorUnits : this.minorUnits;
    if (this.fractionDigits === 0) {
      return `${sign}${absolute}`;
    }
    const padded = absolute.toString().padStart(this.fractionDigits + 1, "0");
    const integer = padded.slice(0, -this.fractionDigits);
    const fraction = padded.slice(-this.fractionDigits);
    return `${sign}${integer}.${fraction}`;
  }

  public toJSON(): MoneyJson {
    return {
      amount: this.toDecimal(),
      currency: this.currency,
      fractionDigits: this.fractionDigits,
    };
  }

  private assertCompatible(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
    if (this.fractionDigits !== other.fractionDigits) {
      throw new MoneyScaleMismatchError(
        this.fractionDigits,
        other.fractionDigits,
      );
    }
  }
}

export function normalizeAmount(
  amount: string,
  currency: string,
  options?: MoneyOptions,
): Money {
  return Money.fromDecimal(amount, currency, options);
}
