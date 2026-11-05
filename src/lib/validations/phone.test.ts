import { describe, expect, it } from "vitest";

import { isCompleteMobile } from "./phone";

describe("isCompleteMobile", () => {
  it("accepts complete Philippine mobile numbers however they're written", () => {
    for (const n of [
      "09171234567",
      "0917 123 4567",
      "0917-123-4567",
      "+63 917 123 4567",
      "+639171234567",
      "639171234567",
      "917 123 4567",
      "(0917) 123.4567",
    ]) {
      expect(isCompleteMobile(n), n).toBe(true);
    }
  });

  it("rejects incomplete or too long Philippine numbers", () => {
    for (const n of [
      "0917 123",
      "0917123456",
      "091712345678",
      "+63 917 123 456",
      "1234567",
      "02 8123 4567",
      "",
    ]) {
      expect(isCompleteMobile(n), n).toBe(false);
    }
  });

  it("accepts other countries only with a + and country code", () => {
    expect(isCompleteMobile("+1 415 555 0132")).toBe(true);
    expect(isCompleteMobile("+44 7911 123456")).toBe(true);
    expect(isCompleteMobile("+1 415")).toBe(false);
    expect(isCompleteMobile("415 555 0132")).toBe(false);
  });

  it("rejects letters", () => {
    expect(isCompleteMobile("0917 ABC 4567")).toBe(false);
  });
});
