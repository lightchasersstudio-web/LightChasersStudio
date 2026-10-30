import { describe, expect, it } from "vitest";

import {
  bookingFiltersSchema,
  filtersHref,
  listFiltersSchema,
  parseFilters,
  searchTerm,
} from "./list-filters";

describe("parseFilters", () => {
  it("reads valid booking filters from the URL", () => {
    expect(
      parseFilters(bookingFiltersSchema, {
        q: "  Ana ",
        status: "confirmed",
        service: "8c4f0a52-3c1e-4b8e-9a51-2a7f1d6c9e01",
        from: "2026-11-01",
        to: ["2026-11-30", "ignored"],
        page: "3",
      }),
    ).toEqual({
      q: "Ana",
      status: "confirmed",
      service: "8c4f0a52-3c1e-4b8e-9a51-2a7f1d6c9e01",
      from: "2026-11-01",
      to: "2026-11-30",
      page: 3,
    });
  });

  it("ignores anything malformed instead of failing", () => {
    expect(
      parseFilters(bookingFiltersSchema, {
        status: "paid",
        service: "x",
        from: "1 Nov",
        page: "-2",
      }),
    ).toEqual({ q: "", status: "", service: "", from: "", to: "", page: 1 });
    expect(parseFilters(listFiltersSchema, {})).toEqual({ q: "", kind: "", page: 1 });
  });
});

describe("filtersHref", () => {
  it("keeps only the filters that are set", () => {
    expect(filtersHref("/admin/bookings", { q: "", status: "pending", page: 1 })).toBe(
      "/admin/bookings?status=pending",
    );
    expect(filtersHref("/admin/bookings", { q: "a b", page: 2 })).toBe(
      "/admin/bookings?q=a+b&page=2",
    );
    expect(filtersHref("/admin/clients", { q: "", page: 1 })).toBe("/admin/clients");
  });
});

describe("searchTerm", () => {
  it("strips characters that would break a PostgREST filter", () => {
    expect(searchTerm('ana,status.eq.x)(%*"\\')).toBe("ana status.eq.x");
    expect(searchTerm("  BK-2026-7C21E5 ")).toBe("BK-2026-7C21E5");
  });
});
