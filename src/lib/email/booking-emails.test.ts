import { describe, expect, it } from "vitest";

import type { BookingSummary } from "@/lib/booking/booking-summary";

import {
  balancePaidAlertEmail,
  bookingConfirmedEmail,
  bookingListEmail,
  bookingUpdatedEmail,
  newBookingAlertEmail,
  paymentReceivedEmail,
  rescheduleRequestAlertEmail,
  shootReminderEmail,
} from "./booking-emails";

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

  it("lists each workshop person, escaped, with the refund rule", () => {
    const email = bookingConfirmedEmail(
      {
        ...booking,
        people: [
          { name: "Ana <i>Cruz</i>", category: "Early bird", priceCents: 400000 },
          { name: "Ben Reyes", category: "Student", priceCents: 400000 },
        ],
      },
      "https://studio.example",
    );
    expect(email.html).toContain("Ana &lt;i&gt;Cruz&lt;/i&gt; · Early bird · ₱4,000");
    expect(email.html).toContain("Refunds:");
    expect(email.text).toContain("Person 2: Ben Reyes · Student · ₱4,000");
    expect(email.text).toContain("Refunds: Paid half");
    expect(bookingConfirmedEmail(booking, "https://studio.example").html).not.toContain("Refunds:");
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

  it("tells clients to keep their reference, but not the studio alert", () => {
    expect(bookingConfirmedEmail(booking, "https://studio.example").text).toContain(
      "Keep this email: your reference BK-2026-ABC123",
    );
    expect(
      newBookingAlertEmail(booking, "https://studio.example", "b-1", false).html,
    ).not.toContain("Keep this email");
  });

  it("lists every booking for the email with a link to each", () => {
    const email = bookingListEmail(
      [
        {
          reference: "BK-2026-ABC123",
          serviceName: "Family <Portrait>",
          startAt: booking.startAt,
          endAt: null,
          statusLabel: "Confirmed",
        },
        {
          reference: "BK-2025-FFF000",
          serviceName: "Prenup",
          startAt: "2025-02-01T02:00:00.000Z",
          endAt: null,
          statusLabel: "Completed",
        },
      ],
      { name: "Light Chasers Studio", phone: null, email: null },
      "https://studio.example",
    );
    expect(email.subject).toBe("Your Light Chasers Studio booking references");
    expect(email.html).toContain("Family &lt;Portrait&gt;");
    expect(email.text).toContain("https://studio.example/booking?ref=BK-2026-ABC123");
    expect(email.text).toContain("https://studio.example/booking?ref=BK-2025-FFF000");
  });

  it("reminds the client the day before, with the balance only when one is due", () => {
    const email = shootReminderEmail(booking, "https://studio.example");
    expect(email.subject).toBe("See you tomorrow! Family Portrait Session · BK-2026-ABC123");
    expect(email.text).toContain("https://studio.example/prepare");
    expect(email.text).toContain("Balance still to pay: ₱2,450");
    const paid = shootReminderEmail({ ...booking, paidCents: 350000 }, "https://studio.example");
    expect(paid.text).not.toContain("Balance still to pay");
  });

  it("sends the studio the client's reschedule request, escaped", () => {
    const email = rescheduleRequestAlertEmail(booking, "https://studio.example", "b-1", {
      preferred: "Any <Saturday>",
      message: "Can we move it?",
    });
    expect(email.subject).toBe("Reschedule request: BK-2026-ABC123");
    expect(email.html).toContain("Any &lt;Saturday&gt;");
    expect(email.text).toContain("Message: Can we move it?");
    expect(email.text).toContain("https://studio.example/admin/bookings/b-1");
  });

  it("confirms a balance payment to both sides", () => {
    expect(paymentReceivedEmail(booking, "https://studio.example").subject).toBe(
      "Payment received for BK-2026-ABC123",
    );
    expect(balancePaidAlertEmail(booking, "https://studio.example", "b-1").subject).toBe(
      "Balance paid online: BK-2026-ABC123",
    );
  });
});
