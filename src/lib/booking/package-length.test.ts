import { describe, expect, it } from "vitest";

import { addOnOffered, bookingLengthMinutes, sessionEndAt } from "./package-length";

describe("bookingLengthMinutes", () => {
  it("holds one slot for packages without a set length", () => {
    expect(bookingLengthMinutes(null, 120, 30)).toBe(30);
  });

  it("adds extension time to a package with a set length", () => {
    expect(bookingLengthMinutes(240, 0, 30)).toBe(240);
    expect(bookingLengthMinutes(240, 60, 30)).toBe(300);
  });
});

describe("addOnOffered", () => {
  it("offers an add-on with every package when none are listed", () => {
    expect(addOnOffered({ service_ids: [] }, "a")).toBe(true);
  });

  it("offers it only with the listed packages otherwise", () => {
    expect(addOnOffered({ service_ids: ["a"] }, "a")).toBe(true);
    expect(addOnOffered({ service_ids: ["a"] }, "b")).toBe(false);
  });
});

describe("sessionEndAt", () => {
  it("has no end without a set length", () => {
    expect(sessionEndAt("2026-11-03T05:00:00.000Z", null, 60)).toBeNull();
  });

  it("ends after the length plus extensions", () => {
    expect(sessionEndAt("2026-11-03T05:00:00.000Z", 240, 60)).toBe("2026-11-03T10:00:00.000Z");
  });
});
