import { describe, expect, it } from "vitest";

import { parseFinderQuery, REFERENCE_RE } from "./reference";

describe("parseFinderQuery", () => {
  it("reads a reference however it was typed", () => {
    for (const typed of ["BK-2026-1A2B3C", " bk-2026-1a2b3c ", "BK 2026 1A2B3C", "20261a2b3c"]) {
      expect(parseFinderQuery(typed)).toEqual({ kind: "reference", value: "BK-2026-1A2B3C" });
    }
  });

  it("reads an email in lower case", () => {
    expect(parseFinderQuery(" Ana@Example.com ")).toEqual({
      kind: "email",
      value: "ana@example.com",
    });
  });

  it("rejects anything else", () => {
    for (const typed of ["", "hello", "BK-2026-XYZ123", "ana@", "BK-26-1A2B3C"]) {
      expect(parseFinderQuery(typed)).toEqual({ kind: "invalid" });
    }
  });

  it("produces references the lookup accepts", () => {
    const q = parseFinderQuery("bk20261a2b3c");
    expect(q.kind === "reference" && REFERENCE_RE.test(q.value)).toBe(true);
  });
});
