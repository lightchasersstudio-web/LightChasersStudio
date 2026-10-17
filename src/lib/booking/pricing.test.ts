import { describe, expect, it } from "vitest";

import { bookingTotals } from "./pricing";

describe("bookingTotals", () => {
  it("adds 12% VAT on package + add-ons and takes the deposit from the total", () => {
    expect(
      bookingTotals({
        packageCents: 1_200_000,
        addOnsCents: 250_000,
        vatPercent: 12,
        fixedDepositCents: null,
        depositPercent: 30,
      }),
    ).toEqual({ subtotal: 1_450_000, vat: 174_000, total: 1_624_000, deposit: 487_200 });
  });

  it("keeps a package's fixed deposit and skips VAT at 0%", () => {
    expect(
      bookingTotals({
        packageCents: 350_000,
        addOnsCents: 0,
        vatPercent: 0,
        fixedDepositCents: 100_000,
        depositPercent: 30,
      }),
    ).toEqual({ subtotal: 350_000, vat: 0, total: 350_000, deposit: 100_000 });
  });

  it("rounds VAT to the nearest centavo like Postgres round()", () => {
    // 12% of ₱333.33 = ₱39.9996 → ₱40.00
    expect(
      bookingTotals({
        packageCents: 33_333,
        addOnsCents: 0,
        vatPercent: 12,
        fixedDepositCents: null,
        depositPercent: 0,
      }).vat,
    ).toBe(4_000);
  });
});
