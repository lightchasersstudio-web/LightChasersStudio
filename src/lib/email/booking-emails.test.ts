import { describe, expect, it } from "vitest";

import type { BookingSummary } from "@/lib/booking/booking-summary";

import { bookingConfirmedEmail, newBookingAlertEmail } from "./booking-emails";

const booking: BookingSummary = {
  reference: "BK-2026-ABC123",
  serviceName: "Family Portrait Session",
  startAt: "2026-11-03T05:00:00.000Z",
  endAt: "2026-11-03T06:00:00.000Z",
  location: "<script>alert(1)</script>",
  priceCents: 350000,
  paidCents: 105000,
  contactName: 'Ana "<b>" Cruz',
  studioName: "Light Chasers Studio",
  studioPhone: null,
  studioEmail: "hello@example.com",
};

describe("booking emails", () => {
  it("escapes what the client typed and links to their booking page", () => {
    const email = bookingConfirmedEmail(booking, "https://studio.example");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain('"<b>"');
    expect(email.subject).toContain("BK-2026-ABC123");
    expect(email.text).toContain("https://studio.example/booking?ref=BK-2026-ABC123");
    expect(email.text).toContain("Balance: ₱2,450");
  });

  it("points the studio alert at the admin booking page", () => {
    const email = newBookingAlertEmail(booking, "https://studio.example", "b-1", true);
    expect(email.text).toContain("https://studio.example/admin/bookings/b-1");
    expect(email.subject).toMatch(/needs review/i);
  });
});
