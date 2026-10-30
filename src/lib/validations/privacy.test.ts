import { describe, expect, it } from "vitest";

import { namesMatch } from "./privacy";

describe("namesMatch", () => {
  it("ignores case and extra spaces, nothing else", () => {
    expect(namesMatch("  ana   CRUZ ", "Ana Cruz")).toBe(true);
    expect(namesMatch("Ana", "Ana Cruz")).toBe(false);
  });
});
