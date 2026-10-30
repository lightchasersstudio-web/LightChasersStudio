import { describe, expect, it } from "vitest";

import type { BookingSummary } from "@/lib/booking/booking-summary";

import { bookingConfirmedEmail, bookingUpdatedEmail, newBookingAlertEmail } from "./booking-emails";

const booking: BookingSummary = {
  reference: "BK-2026-ABC123",
  serviceName: "Family Portrait Session",
  addOns: [],
  startAt: "2026-11-03T05:00:00.000Z",
  endAt: "2026-11-03T06:00:00.000Z",
  location: "<script>alert(1)</script>",
  priceCents: 350000,
  vatCents: 0,
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

  it("shows the studio logo from the live site", () => {
    const email = bookingConfirmedEmail(booking, "https://studio.example");
    expect(email.html).toContain('src="https://studio.example/brand/logo.jpg"');
    expect(email.html).toContain('alt="Light Chasers Studio"');
  });

  it("points the studio alert at the admin booking page", () => {
    const email = newBookingAlertEmail(booking, "https://studio.example", "b-1", true);
    expect(email.text).toContain("https://studio.example/admin/bookings/b-1");
    expect(email.subject).toMatch(/needs review/i);
  });

  it("tells the client their booking was changed, with the new details", () => {
    const email = bookingUpdatedEmail(booking, "https://studio.example");
    expect(email.subject).toBe("Your booking BK-2026-ABC123 was updated");
    expect(email.text).toContain("Tue, 3 Nov 2026, 1:00 PM");
    expect(email.text).toContain("https://studio.example/booking?ref=BK-2026-ABC123");
  });
});
