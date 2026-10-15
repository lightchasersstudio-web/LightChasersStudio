import { describe, expect, it } from "vitest";

import { bookHref } from "@/components/public/site-nav";

describe("bookHref", () => {
  it("opens the wizard with the chosen package", () => {
    expect(bookHref("prenup-session")).toBe("/book?service=prenup-session");
  });

  it("opens the wizard without a package", () => {
    expect(bookHref()).toBe("/book");
  });
});
