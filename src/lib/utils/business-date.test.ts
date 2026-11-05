import { describe, expect, it } from "vitest";

import {
  businessDateTimeToIso,
  businessTomorrowRange,
  manilaDate,
  manilaTime,
  shiftMonth,
} from "./business-date";

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

describe("businessTomorrowRange", () => {
  it("covers tomorrow in Manila, even late in the UTC day", () => {
    // 2026-11-05 17:30 UTC is already 6 Nov 01:30 in Manila, so "tomorrow" is 7 Nov.
    expect(businessTomorrowRange(new Date("2026-11-05T17:30:00Z"))).toEqual({
      from: "2026-11-06T16:00:00.000Z",
      to: "2026-11-07T16:00:00.000Z",
    });
    // 01:00 UTC (the cron) = 09:00 Manila on 6 Nov → tomorrow is 7 Nov.
    expect(businessTomorrowRange(new Date("2026-11-06T01:00:00Z")).from).toBe(
      "2026-11-06T16:00:00.000Z",
    );
  });

  it("rolls over month ends", () => {
    expect(businessTomorrowRange(new Date("2026-11-30T03:00:00Z"))).toEqual({
      from: "2026-11-30T16:00:00.000Z",
      to: "2026-12-01T16:00:00.000Z",
    });
  });
});
