import { describe, expect, it } from "vitest";

import type { BookingSummary } from "./booking-summary";
import { replyTemplates } from "./reply-templates";

const booking: BookingSummary = {
  reference: "BK-2026-ABC123",
  serviceName: "Family Portrait Session",
  addOns: [],
  startAt: "2026-11-03T05:00:00.000Z", // 1:00 PM in Manila
  endAt: "2026-11-03T06:00:00.000Z",
  location: "Studio",
  priceCents: 350000,
  vatCents: 0,
  paidCents: 105000,
  contactName: "Ana Maria Cruz",
  studioName: "Light Chasers Studio",
  studioPhone: null,
  studioEmail: null,
};
const url = "https://example.com/booking?ref=BK-2026-ABC123";

describe("replyTemplates", () => {
  it("fills in the first name, package, Manila time and balance", () => {
    const confirmed = replyTemplates(booking, url).find((t) => t.id === "confirmed")!;
    expect(confirmed.text).toContain("Hi Ana!");
    expect(confirmed.text).toContain("Family Portrait Session");
    expect(confirmed.text).toContain("Tue, 3 Nov 2026, 1:00 PM – 2:00 PM at Studio");
    expect(confirmed.text).toContain("Remaining balance: ₱2,450");
    expect(confirmed.text).toContain(url);

    const reminder = replyTemplates(booking, url).find((t) => t.id === "reminder")!;
    expect(reminder.text).toContain("Tuesday, 3 November at 1:00 PM");
  });

  it("drops the balance reminder once fully paid", () => {
    const paid = replyTemplates({ ...booking, paidCents: 350000 }, url);
    expect(paid.map((t) => t.id)).not.toContain("balance");
    expect(paid.find((t) => t.id === "confirmed")!.text).toContain("fully paid");
    expect(replyTemplates(booking, url).map((t) => t.id)).toContain("balance");
  });
});
