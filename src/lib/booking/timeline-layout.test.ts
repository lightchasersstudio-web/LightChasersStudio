import { describe, expect, it } from "vitest";

import { layoutDay } from "./timeline-layout";

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 3, h, m));
const b = (id: string, from: number, to: number) => ({ id, start: at(from), end: at(to) });

describe("layoutDay", () => {
  it("gives bookings that don't overlap the full width", () => {
    expect(layoutDay([b("a", 9, 10), b("b", 11, 12)])).toEqual([
      { id: "a", column: 0, columns: 1 },
      { id: "b", column: 0, columns: 1 },
    ]);
  });

  it("puts overlapping bookings side by side", () => {
    expect(layoutDay([b("a", 9, 12), b("b", 10, 11), b("c", 10, 13)])).toEqual([
      { id: "a", column: 0, columns: 3 },
      { id: "b", column: 1, columns: 3 },
      { id: "c", column: 2, columns: 3 },
    ]);
  });

  it("reuses a column once its booking has ended", () => {
    // a and b overlap; c starts after a ends, so it takes a's column within the same group.
    expect(layoutDay([b("a", 9, 10), b("b", 9, 12), b("c", 10, 11)])).toEqual([
      { id: "a", column: 0, columns: 2 },
      { id: "b", column: 1, columns: 2 },
      { id: "c", column: 0, columns: 2 },
    ]);
  });
});
