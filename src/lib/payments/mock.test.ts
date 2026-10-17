import { describe, expect, it } from "vitest";

import { paymentsMockEnabled } from "./mock";

describe("paymentsMockEnabled", () => {
  it("is on only when PAYMENTS_MOCK=true", () => {
    expect(paymentsMockEnabled({ PAYMENTS_MOCK: "true" })).toBe(true);
    expect(paymentsMockEnabled({ PAYMENTS_MOCK: "1" })).toBe(false);
    expect(paymentsMockEnabled({})).toBe(false);
  });

  it("can never turn on for the live Vercel site", () => {
    expect(paymentsMockEnabled({ PAYMENTS_MOCK: "true", VERCEL_ENV: "production" })).toBe(false);
    expect(paymentsMockEnabled({ PAYMENTS_MOCK: "true", VERCEL_ENV: "preview" })).toBe(true);
  });
});
