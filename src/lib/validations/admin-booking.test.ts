import { describe, expect, it } from "vitest";

import {
  adminBookingSchema,
  bookingStatusSchema,
  recordPaymentSchema,
  type AdminBookingInput,
} from "./admin-booking";

const base: AdminBookingInput = {
  serviceId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  date: "2026-11-03",
  time: "13:00",
  price: "2,500",
  fullName: "Walk In Client",
  email: "",
  phone: "0917 123 4567",
  preferredContact: "phone",
  messenger: "",
  location: "",
  participants: "2",
  specialRequests: "",
  deposit: "none",
  depositAmount: "",
  gcashReference: "",
  consent: true,
  allowOutsideHours: false,
};

const issuesAt = (input: AdminBookingInput) => {
  const r = adminBookingSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("adminBookingSchema", () => {
  it("reads the date and time as Manila time and the price as centavos", () => {
    const v = adminBookingSchema.parse(base);
    expect(v.startAt).toBe("2026-11-03T05:00:00.000Z");
    expect(v.priceCents).toBe(250000);
    expect(v.email).toBeNull();
    expect(v.payment).toBeNull();
  });

  it("lets staff book without an email, unless email is how to reach them", () => {
    expect(issuesAt(base)).toEqual([]);
    expect(issuesAt({ ...base, preferredContact: "email" })).toEqual(["email"]);
  });

  it("records a GCash or cash deposit with its amount", () => {
    const v = adminBookingSchema.parse({
      ...base,
      deposit: "gcash",
      depositAmount: "500",
      gcashReference: "1234 567 890",
    });
    expect(v.payment).toEqual({ provider: "gcash", amountCents: 50000, reference: "1234 567 890" });
  });

  it("needs an amount for GCash or cash, no more than the price", () => {
    expect(issuesAt({ ...base, deposit: "cash" })).toEqual(["depositAmount"]);
    expect(issuesAt({ ...base, deposit: "cash", depositAmount: "3000" })).toEqual([
      "depositAmount",
    ]);
  });
});

describe("recordPaymentSchema", () => {
  const id = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("records a GCash payment in centavos", () => {
    expect(
      recordPaymentSchema.parse({
        bookingId: id,
        provider: "gcash",
        amount: "1,500",
        reference: "",
      }),
    ).toEqual({ bookingId: id, provider: "gcash", amountCents: 150000, reference: null });
  });

  it("rejects a zero amount and online providers", () => {
    expect(
      recordPaymentSchema.safeParse({ bookingId: id, provider: "cash", amount: "0", reference: "" })
        .success,
    ).toBe(false);
    expect(
      recordPaymentSchema.safeParse({
        bookingId: id,
        provider: "paymongo",
        amount: "5",
        reference: "",
      }).success,
    ).toBe(false);
  });
});

describe("bookingStatusSchema", () => {
  it("only offers the moves staff make by hand", () => {
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    for (const status of ["confirmed", "declined", "completed", "cancelled"]) {
      expect(bookingStatusSchema.safeParse({ id, status }).success).toBe(true);
    }
    expect(bookingStatusSchema.safeParse({ id, status: "pending" }).success).toBe(false);
  });
});
