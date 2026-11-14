import { describe, expect, it } from "vitest";

import { bookingChargeSchema } from "@/lib/validations/admin-booking";
import { chargePricesSchema } from "@/lib/validations/settings";

import { chargeLine } from "./charges";

// The studio policy's prices: cleaning ₱500, paper ₱600/yard, ₱500/person, ₱50/day.
const prices = {
  cleaning_fee_cents: 50_000,
  backdrop_paper_yard_cents: 60_000,
  extra_person_cents: 50_000,
  storage_day_cents: 5_000,
};
const id = "00000000-0000-4000-8000-000000000001";

describe("extra charges", () => {
  it("prices presets from Settings × quantity", () => {
    expect(
      chargeLine({ kind: "backdrop_paper", quantity: 3, amountCents: null, note: null }, prices),
    ).toEqual({
      name: "Backdrop paper × 3 yards (₱600 per yard)",
      priceCents: 180_000,
    });
    expect(
      chargeLine({ kind: "cleaning", quantity: 5, amountCents: null, note: null }, prices),
    ).toEqual({ name: "Cleaning fee", priceCents: 50_000 });
  });

  it("takes the typed amount and note for damage", () => {
    expect(
      chargeLine({ kind: "damage", quantity: 1, amountCents: 250_000, note: "Softbox" }, prices),
    ).toEqual({ name: "Damage: Softbox", priceCents: 250_000 });
  });

  it("needs an amount and a note for damage", () => {
    const r = bookingChargeSchema.safeParse({ bookingId: id, kind: "damage", quantity: "1" });
    expect(r.success).toBe(false);
    const ok = bookingChargeSchema.safeParse({
      bookingId: id,
      kind: "damage",
      quantity: "1",
      amount: "2500",
      note: "Softbox",
    });
    expect(ok.success && ok.data.amountCents).toBe(250_000);
  });
});

describe("chargePricesSchema", () => {
  it("turns pesos into centavos (empty = 0)", () => {
    const r = chargePricesSchema.parse({
      cleaningFee: "500",
      backdropPaperYard: "600",
      extraPerson: "",
      storageDay: "50.50",
      securityDeposit: "2000",
    });
    expect(r).toEqual({
      cleaning_fee_cents: 50_000,
      backdrop_paper_yard_cents: 60_000,
      extra_person_cents: 0,
      storage_day_cents: 5_050,
      security_deposit_cents: 200_000,
    });
  });

  it("refuses text that isn't an amount", () => {
    expect(
      chargePricesSchema.safeParse({
        cleaningFee: "five hundred",
        backdropPaperYard: "0",
        extraPerson: "0",
        storageDay: "0",
        securityDeposit: "0",
      }).success,
    ).toBe(false);
  });
});
