import { describe, expect, it } from "vitest";

import {
  cutoffShare,
  DEFAULT_RATES,
  monthlyContributions,
  sssMsc,
} from "@/lib/payroll/contributions";

const r = DEFAULT_RATES;

describe("sssMsc", () => {
  it("rounds to the nearest ₱500 within ₱5,000–₱35,000", () => {
    expect(sssMsc(3000, r)).toBe(5000);
    expect(sssMsc(5249.99, r)).toBe(5000);
    expect(sssMsc(5250, r)).toBe(5500);
    expect(sssMsc(5749.99, r)).toBe(5500);
    expect(sssMsc(20000, r)).toBe(20000);
    expect(sssMsc(20300, r)).toBe(20500);
    expect(sssMsc(34749.99, r)).toBe(34500);
    expect(sssMsc(80000, r)).toBe(35000);
  });
});

describe("monthlyContributions", () => {
  it("uses the 2026 employee shares", () => {
    expect(monthlyContributions(20000, r)).toEqual({
      sss: { base: 20000, monthly: 1000 },
      philhealth: { base: 20000, monthly: 500 },
      pagibig: { base: 10000, monthly: 200 },
    });
  });

  it("applies the floors and caps", () => {
    const low = monthlyContributions(8000, r);
    expect(low.sss).toEqual({ base: 8000, monthly: 400 });
    expect(low.philhealth).toEqual({ base: 10000, monthly: 250 }); // floor
    expect(low.pagibig).toEqual({ base: 8000, monthly: 160 });

    const high = monthlyContributions(150000, r);
    expect(high.sss).toEqual({ base: 35000, monthly: 1750 });
    expect(high.philhealth).toEqual({ base: 100000, monthly: 2500 }); // ceiling
    expect(high.pagibig).toEqual({ base: 10000, monthly: 200 }); // max ₱200
  });

  it("rounds to the centavo", () => {
    expect(monthlyContributions(16913, r).philhealth.monthly).toBe(422.83);
  });
});

describe("cutoffShare", () => {
  it("splits a month in two halves that add back up", () => {
    expect(cutoffShare(1000, 1)).toBe(500);
    expect(cutoffShare(1000, 2)).toBe(500);
    expect(cutoffShare(422.83, 1)).toBe(211.41);
    expect(cutoffShare(422.83, 2)).toBe(211.42);
  });
});
