import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

import { WORKSHOP_REFUND_RULE } from "@/lib/booking/workshop";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { ATTENDEE_CATEGORIES } from "@/lib/validations/booking";
import { formatPeso } from "@/lib/utils/money";

/** Everything the booking card, "copy as text" and emails show. */
export type BookingSummary = {
  reference: string;
  serviceName: string;
  /** Extras booked with the package, at the price they were booked for. */
  addOns: { name: string; priceCents: number }[];
  startAt: string;
  /** Only packages with a set length (the Photobooth) have an end time. */
  endAt: string | null;
  location: string | null;
  priceCents: number;
  /** VAT included in priceCents (0 when none was charged). */
  vatCents: number;
  paidCents: number;
  contactName: string;
  studioName: string;
  studioPhone: string | null;
  studioEmail: string | null;
  /** Workshop sign-ups: each person with their price category label and price. */
  people?: { name: string; category: string; priceCents: number }[];
};

/** BookingSummary.people from booking_attendees rows, in sign-up order; undefined for a shoot. */
export function summaryPeople(
  rows: { position: number; full_name: string; category: string; price_cents: number }[],
): BookingSummary["people"] {
  if (rows.length === 0) return undefined;
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((a) => ({
      name: a.full_name,
      category: ATTENDEE_CATEGORIES.find((c) => c.value === a.category)?.label ?? a.category,
      priceCents: a.price_cents,
    }));
}

/** "Ana Cruz · Early bird · ₱4,000" */
export const formatPerson = (p: NonNullable<BookingSummary["people"]>[number]) =>
  `${p.name} · ${p.category} · ${formatPeso(p.priceCents)}`;

/**
 * "Tue, 3 Nov 2026, 1:00 PM – 5:00 PM" in Manila time, or just the start
 * ("Tue, 3 Nov 2026, 1:00 PM") when the booking has no end time.
 */
export function formatBookingWhen(startAt: string, endAt: string | null): string {
  const start = format(new TZDate(startAt, BUSINESS_TZ), "EEE, d MMM yyyy, h:mm a");
  return endAt ? `${start} – ${format(new TZDate(endAt, BUSINESS_TZ), "h:mm a")}` : start;
}

/** "Extra photographer (₱2,000), Videographer (₱5,000)", or null when there are none. */
export function formatAddOns(addOns: BookingSummary["addOns"]): string | null {
  if (addOns.length === 0) return null;
  return addOns.map((a) => `${a.name} (${formatPeso(a.priceCents)})`).join(", ");
}

/** Plain-text booking details to paste into Messenger. */
export function bookingSummaryText(b: BookingSummary): string {
  const balance = Math.max(b.priceCents - b.paidCents, 0);
  return [
    `${b.studioName} booking`,
    `Reference: ${b.reference}`,
    `Name: ${b.contactName}`,
    `Package: ${b.serviceName}`,
    ...(b.people ?? []).map((p, i) => `Person ${i + 1}: ${formatPerson(p)}`),
    b.addOns.length > 0 && `Add-ons: ${formatAddOns(b.addOns)}`,
    `When: ${formatBookingWhen(b.startAt, b.endAt)}`,
    b.location && `Location: ${b.location}`,
    `Total: ${formatPeso(b.priceCents)}${b.vatCents > 0 ? ` (incl. ${formatPeso(b.vatCents)} VAT)` : ""}`,
    `Paid: ${formatPeso(b.paidCents)}`,
    balance > 0 ? `Balance: ${formatPeso(balance)}` : "Fully paid",
    b.people && `Refunds: ${WORKSHOP_REFUND_RULE}`,
    [b.studioPhone, b.studioEmail].filter(Boolean).join(" · ") &&
      `Questions? ${[b.studioPhone, b.studioEmail].filter(Boolean).join(" · ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}
