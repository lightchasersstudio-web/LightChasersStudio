import { describe, expect, it } from "vitest";

import { returnDepositSchema, collectDepositSchema } from "@/lib/validations/admin-booking";

import { checkInProgress, depositKeptCents, depositState, type SecurityDeposit } from "./check-in";
import { describeHistoryEntry } from "./history";

const none: SecurityDeposit = {
  expected: false,
  collectedCents: null,
  method: null,
  collectedAt: null,
  returnedCents: null,
  returnedAt: null,
  note: null,
};
const at = "2026-11-14T02:00:00.000Z";
const noSteps = { id_checked_at: null, inspected_in_at: null, inspected_out_at: null };
const id = "00000000-0000-4000-8000-000000000001";

describe("security deposit", () => {
  it("goes due → held → returned", () => {
    expect(depositState(none)).toBe("not_needed");
    expect(depositState({ ...none, expected: true })).toBe("due");
    const held = {
      ...none,
      expected: true,
      collectedCents: 200_000,
      method: "cash",
      collectedAt: at,
    };
    expect(depositState(held)).toBe("held");
    const back = { ...held, returnedCents: 150_000, returnedAt: at, note: "Cleaning fee" };
    expect(depositState(back)).toBe("returned");
    expect(depositKeptCents(back)).toBe(50_000);
  });

  it("can be collected when nobody said pets or mess at booking", () => {
    expect(
      depositState({ ...none, collectedCents: 200_000, method: "gcash", collectedAt: at }),
    ).toBe("held");
  });
});

describe("checkInProgress", () => {
  it("counts the steps and the balance, and the deposit only when there is one", () => {
    expect(
      checkInProgress({ studio: false, steps: noSteps, balanceCents: 0, deposit: none }),
    ).toEqual({ done: 1, total: 1 });
    expect(
      checkInProgress({ studio: true, steps: noSteps, balanceCents: 5000, deposit: none }),
    ).toEqual({
      done: 0,
      total: 4,
    });
    expect(
      checkInProgress({
        studio: true,
        steps: { id_checked_at: at, inspected_in_at: at, inspected_out_at: at },
        balanceCents: 0,
        deposit: { ...none, expected: true },
      }),
    ).toEqual({ done: 4, total: 5 });
  });
});

describe("deposit forms", () => {
  it("needs an amount to collect", () => {
    expect(
      collectDepositSchema.safeParse({ bookingId: id, amount: "0", method: "cash" }).success,
    ).toBe(false);
    const ok = collectDepositSchema.parse({ bookingId: id, amount: "2000", method: "maya" });
    expect(ok).toMatchObject({ amountCents: 200_000, method: "maya" });
  });

  it("allows giving back nothing (all kept)", () => {
    expect(
      returnDepositSchema.parse({ bookingId: id, returned: "0", note: "Broken light" }),
    ).toMatchObject({ returnedCents: 0, note: "Broken light" });
  });
});

describe("history lines", () => {
  it("says who ticked what and where the deposit went", () => {
    expect(describeHistoryEntry("booking.check_in", { step: "ID checked" })).toBe(
      "Ticked: ID checked",
    );
    expect(
      describeHistoryEntry("booking.deposit_collect", { amount_cents: 200_000, provider: "cash" }),
    ).toBe("Collected a ₱2,000 security deposit (cash)");
    expect(
      describeHistoryEntry("booking.deposit_return", { amount_cents: 150_000, kept_cents: 50_000 }),
    ).toBe("Returned ₱1,500 of the security deposit, kept ₱500");
    expect(describeHistoryEntry("booking.deposit_return", { amount_cents: 200_000 })).toBe(
      "Returned ₱2,000 of the security deposit in full",
    );
  });
});
