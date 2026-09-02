import { describe, expect, it } from "vitest";

import {
  CurrencyMismatchError,
  InvalidMoneyError,
  Money,
  MoneyScaleMismatchError,
  NegativeMoneyError,
  normalizeAmount,
} from "./money.js";

describe("Money", () => {
  it("stores normalized amounts as integer minor units", () => {
    const money = Money.fromDecimal("9007199254740993.27", "brl");
    expect(money.minorUnits).toBe(900719925474099327n);
    expect(money.currency).toBe("BRL");
    expect(money.toDecimal()).toBe("9007199254740993.27");
  });

  it("rejects numeric inputs instead of accepting floating-point values", () => {
    expect(() =>
      Money.fromDecimal(1.1 as unknown as string, "BRL"),
    ).toThrowError(InvalidMoneyError);
  });

  it.each([
    ["1.004", "1.00"],
    ["1.005", "1.01"],
    ["1.006", "1.01"],
    ["-1.004", "-1.00"],
    ["-1.005", "-1.01"],
    ["-1.006", "-1.01"],
  ])("rounds %s to %s using half away from zero", (input, expected) => {
    expect(Money.fromDecimal(input, "USD").toDecimal()).toBe(expected);
  });

  it("can reject precision loss when exact scale is required", () => {
    expect(() =>
      Money.fromDecimal("1.001", "USD", { roundingMode: "reject" }),
    ).toThrowError(InvalidMoneyError);
    expect(
      Money.fromDecimal("1.000", "USD", { roundingMode: "reject" }).toDecimal(),
    ).toBe("1.00");
  });

  it("supports explicit zero-decimal and higher-precision currencies", () => {
    expect(
      Money.fromDecimal("101.5", "JPY", { fractionDigits: 0 }).toDecimal(),
    ).toBe("102");
    expect(
      Money.fromDecimal("0.12345678", "BTC", { fractionDigits: 8 }).toDecimal(),
    ).toBe("0.12345678");
  });

  it("allows signed values for differences and projected balances", () => {
    const deficit = Money.fromDecimal("-42.10", "BRL");
    expect(deficit.isNegative()).toBe(true);
    expect(deficit.negate().toDecimal()).toBe("42.10");
  });

  it("rejects negative values when normalizing plan inputs", () => {
    expect(() =>
      normalizeAmount("-0.01", "BRL", { allowNegative: false }),
    ).toThrowError(NegativeMoneyError);
  });

  it("normalizes negative zero to zero", () => {
    const money = Money.fromDecimal("-0.001", "BRL");
    expect(money.minorUnits).toBe(0n);
    expect(money.toDecimal()).toBe("0.00");
    expect(money.isNegative()).toBe(false);
  });

  it("rejects arithmetic across currencies", () => {
    const brl = Money.fromDecimal("10.00", "BRL");
    const usd = Money.fromDecimal("10.00", "USD");
    expect(() => brl.add(usd)).toThrowError(CurrencyMismatchError);
    expect(() => brl.subtract(usd)).toThrowError(CurrencyMismatchError);
  });

  it("rejects arithmetic across different scales", () => {
    const cents = Money.fromDecimal("10.00", "USD");
    const mills = Money.fromDecimal("10.000", "USD", { fractionDigits: 3 });
    expect(() => cents.add(mills)).toThrowError(MoneyScaleMismatchError);
  });

  it("adds and subtracts with exact integer arithmetic", () => {
    const left = Money.fromDecimal("0.10", "USD");
    const right = Money.fromDecimal("0.20", "USD");
    expect(left.add(right).toDecimal()).toBe("0.30");
    expect(left.subtract(right).toDecimal()).toBe("-0.10");
  });

  it("serializes bigint-backed values safely", () => {
    const money = Money.fromMinorUnits(123n, "USD");
    expect(money.toJSON()).toEqual({
      amount: "1.23",
      currency: "USD",
      fractionDigits: 2,
    });
    expect(JSON.stringify(money)).toBe(
      '{"amount":"1.23","currency":"USD","fractionDigits":2}',
    );
  });

  it.each(["1e3", " 1.00", "1.00 ", ".50", "1.", "NaN", "Infinity"])(
    "rejects ambiguous decimal input %s",
    (input) => {
      expect(() => Money.fromDecimal(input, "USD")).toThrowError(
        InvalidMoneyError,
      );
    },
  );

  it("validates currency codes and scale", () => {
    expect(() => Money.fromDecimal("1.00", "US")).toThrowError(
      InvalidMoneyError,
    );
    expect(() =>
      Money.fromDecimal("1.00", "USD", { fractionDigits: -1 }),
    ).toThrowError(InvalidMoneyError);
  });
});
