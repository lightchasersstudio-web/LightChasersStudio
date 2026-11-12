import { describe, expect, it } from "vitest";

import { rescheduleFeeNotice } from "./reschedule-fee";

describe("rescheduleFeeNotice", () => {
  it("states the fee and VAT, or nothing when rescheduling is free", () => {
    expect(rescheduleFeeNotice(50000, 12)).toBe(
      "Rescheduling costs ₱500 + 12% VAT, added to your balance.",
    );
    expect(rescheduleFeeNotice(50000, 0)).toBe("Rescheduling costs ₱500, added to your balance.");
    expect(rescheduleFeeNotice(0, 12)).toBeNull();
  });
});
