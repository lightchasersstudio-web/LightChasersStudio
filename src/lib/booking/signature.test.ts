import { describe, expect, it } from "vitest";

import { cleanSignature, signatureMatches } from "./signature";

describe("contract signature", () => {
  it("matches the full name, ignoring spacing and capital letters", () => {
    expect(signatureMatches("Ana Cruz", "Ana Cruz")).toBe(true);
    expect(signatureMatches("  ana   CRUZ ", "Ana Cruz")).toBe(true);
  });

  it("refuses a different or missing name", () => {
    expect(signatureMatches("Ana", "Ana Cruz")).toBe(false);
    expect(signatureMatches("Ana Santos", "Ana Cruz")).toBe(false);
    expect(signatureMatches("", "Ana Cruz")).toBe(false);
    expect(signatureMatches(undefined, "Ana Cruz")).toBe(false);
    expect(signatureMatches("A", "A")).toBe(false);
  });

  it("keeps the name as typed, without extra spaces", () => {
    expect(cleanSignature("  Ana   Cruz ")).toBe("Ana Cruz");
  });
});
