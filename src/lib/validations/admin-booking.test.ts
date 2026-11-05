import { describe, expect, it } from "vitest";

import {
  adminBookingEditSchema,
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
  addOns: [],
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

describe("add-ons on staff bookings", () => {
  const catalogId = "8a6e0804-2bd0-4672-b79d-d97027f9071b";

  it("keeps catalog add-ons and custom extras, with prices in centavos", () => {
    const v = adminBookingSchema.parse({
      ...base,
      addOns: [
        { addOnId: catalogId, name: "Videographer", price: "5,000" },
        { addOnId: "", name: "Extra prints", price: "750.50" },
      ],
    });
    expect(v.addOns).toEqual([
      { add_on_id: catalogId, name: "Videographer", price_cents: 500000 },
      { add_on_id: null, name: "Extra prints", price_cents: 75050 },
    ]);
  });

  it("needs a name and a valid price for each add-on", () => {
    const r = adminBookingSchema.safeParse({
      ...base,
      addOns: [{ addOnId: "", name: "X", price: "-1" }],
    });
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join("."))).toEqual([
      "addOns.0.name",
      "addOns.0.price",
    ]);
  });
});

describe("adminBookingEditSchema", () => {
  const edit = {
    bookingId: "0f8fad5b-d9cb-469f-a165-70867728950e",
    serviceId: "8a6e0804-2bd0-4672-b79d-d97027f9071b",
    date: "2026-11-03",
    time: "13:00",
    price: "9,000",
    fullName: "Walk In Client",
    phone: "0917 123 4567",
    preferredContact: "phone" as const,
    messenger: "",
    location: "Studio",
    participants: "2",
    specialRequests: "",
    addOns: [{ addOnId: "", name: "Extra prints", price: "500" }],
    chargeVat: true,
    emailClient: true,
    allowOutsideHours: false,
  };

  it("turns the form into the booking update", () => {
    expect(adminBookingEditSchema.parse(edit)).toMatchObject({
      bookingId: edit.bookingId,
      startAt: "2026-11-03T05:00:00.000Z",
      packageCents: 900000,
      addOns: [{ add_on_id: null, name: "Extra prints", price_cents: 50000 }],
      chargeVat: true,
      emailClient: true,
    });
  });

  it("rejects a negative package price", () => {
    expect(adminBookingEditSchema.safeParse({ ...edit, price: "-5" }).success).toBe(false);
  });
});
