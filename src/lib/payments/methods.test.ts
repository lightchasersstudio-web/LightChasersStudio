import { describe, expect, it } from "vitest";

import { paymentMethodsText } from "./methods";

describe("paymentMethodsText", () => {
  it("names the methods clients can use", () => {
    expect(paymentMethodsText(["qrph"])).toBe("QR Ph (scan with GCash, Maya or any bank app)");
    expect(paymentMethodsText(["gcash", "paymaya", "card"])).toBe("GCash, Maya, or card");
  });
});
