import { describe, expect, it } from "vitest";

import { businessDateTimeToIso, manilaDate, manilaTime, shiftMonth } from "./business-date";

describe("business-date helpers", () => {
  it("moves months across a year boundary", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
  });

  it("converts studio wall-clock time to UTC and back", () => {
    const iso = businessDateTimeToIso("2026-11-03", "00:30");
    expect(iso).toBe("2026-11-02T16:30:00.000Z"); // previous day in UTC
    expect(manilaDate(iso)).toBe("2026-11-03");
    expect(manilaTime(iso)).toBe("12:30 AM");
  });
});
