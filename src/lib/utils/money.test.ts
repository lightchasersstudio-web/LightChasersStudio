import { describe, expect, it } from "vitest";

import { centsToPesoInput, formatPeso, pesosToCents } from "./money";

describe("money", () => {
  it("parses peso input into centavos without float errors", () => {
    expect(pesosToCents("1500")).toBe(150000);
    expect(pesosToCents("1,500.5")).toBe(150050);
    expect(pesosToCents("₱ 0.29")).toBe(29);
    expect(pesosToCents("19.99")).toBe(1999);
  });

  it("rejects negatives, extra decimals and junk", () => {
    for (const bad of ["", "-5", "1.234", "abc", "1e5", "."]) expect(pesosToCents(bad)).toBeNull();
  });

  it("round-trips through the form input format", () => {
    for (const cents of [0, 150000, 150050, 1999]) {
      expect(pesosToCents(centsToPesoInput(cents))).toBe(cents);
    }
  });

  it("formats as PHP", () => {
    expect(formatPeso(150000)).toBe("₱1,500");
    expect(formatPeso(150050)).toBe("₱1,500.50");
  });
});
