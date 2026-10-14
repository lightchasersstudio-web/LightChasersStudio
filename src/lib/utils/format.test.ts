import { describe, expect, it } from "vitest";

import { formatDuration, formatTime } from "./format";

describe("format", () => {
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(150)).toBe("2 hr 30 min");
  });

  it("formats 24h times as 12h", () => {
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("08:05")).toBe("8:05 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("19:30")).toBe("7:30 PM");
  });
});
