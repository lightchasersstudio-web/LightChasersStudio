import { describe, expect, it } from "vitest";

import {
  cancelAdvice,
  closedBookingNote,
  needsStudioPolicy,
  pastRescheduleCutoff,
  rescheduleBlock,
  SHOOT_FLAGS,
} from "./policy";

const now = new Date("2026-11-14T00:00:00.000Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();

describe("studio policy: who agrees", () => {
  it("asks studio packages only", () => {
    expect(needsStudioPolicy("studio")).toBe(true);
    expect(needsStudioPolicy("outside")).toBe(false);
    expect(needsStudioPolicy("excluded")).toBe(false);
    expect(needsStudioPolicy(undefined)).toBe(false);
  });

  it("maps each booking question to its own column", () => {
    expect(SHOOT_FLAGS.map((f) => f.column)).toEqual([
      "sensitive_shoot",
      "pets_or_messy",
      "bts_opt_out",
    ]);
  });
});

describe("rescheduling (policy 1.4)", () => {
  it("closes 48 hours before the start", () => {
    expect(pastRescheduleCutoff(inHours(48.5), now)).toBe(false);
    expect(pastRescheduleCutoff(inHours(47.5), now)).toBe(true);
  });

  it("allows one reschedule only", () => {
    expect(rescheduleBlock({ startAt: inHours(100), rescheduledAt: null }, now)).toBeNull();
    expect(rescheduleBlock({ startAt: inHours(100), rescheduledAt: now.toISOString() }, now)).toBe(
      "already_rescheduled",
    );
    expect(rescheduleBlock({ startAt: inHours(10), rescheduledAt: null }, now)).toBe("too_late");
  });
});

describe("cancellations (policy 1.6–1.8)", () => {
  const facts = { paidCents: 150_000, rescheduleFeeCents: 50_000 };

  it("keeps the down payment when the client cancels", () => {
    expect(cancelAdvice("client", { ...facts, startAt: inHours(10) }, now)).toMatch(
      /can't be rescheduled.*₱1,500.*kept/,
    );
    expect(cancelAdvice("client", { ...facts, startAt: inHours(100) }, now)).toMatch(
      /reschedule instead \(₱500 fee\)/,
    );
  });

  it("refunds everything for force majeure", () => {
    expect(cancelAdvice("force_majeure", { ...facts, startAt: inHours(10) }, now)).toMatch(
      /Refund everything paid \(₱1,500\)/,
    );
  });

  it("explains a no-show and a late cancellation", () => {
    const base = { startAt: inHours(10), cancelReason: null, paidCents: 150_000 };
    expect(closedBookingNote({ ...base, status: "no_show", cancelledAt: null }, "staff")).toMatch(
      /No-show.*kept/,
    );
    expect(
      closedBookingNote(
        { ...base, status: "cancelled", cancelReason: "client", cancelledAt: now.toISOString() },
        "client",
      ),
    ).toMatch(/less than 48 hours/);
    expect(closedBookingNote({ ...base, status: "confirmed", cancelledAt: null }, "staff")).toBe(
      null,
    );
  });
});
