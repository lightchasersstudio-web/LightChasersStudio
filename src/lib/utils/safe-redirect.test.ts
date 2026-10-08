import { describe, expect, it } from "vitest";

import { safeAdminRedirect } from "@/lib/utils/safe-redirect";

describe("safeAdminRedirect", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/bookings", "/admin/bookings"],
    ["/admin/bookings?status=pending", "/admin/bookings?status=pending"],
  ])("allows admin path %s", (input, expected) => {
    expect(safeAdminRedirect(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.com/admin",
    "//evil.com/admin",
    "/\\evil.com",
    "javascript:alert(1)",
    "/services",
    "/administrator",
    "/admin/login",
    "admin",
  ])("falls back to /admin for %s", (input) => {
    expect(safeAdminRedirect(input)).toBe("/admin");
  });
});
