import { BUSINESS_TZ } from "@/lib/utils/business-date";

/** Owner's refund rule for workshops (2026-10-27); refunds are sent by hand. */
export const WORKSHOP_REFUND_RULE =
  "Paid half: no refund if you can't attend. Paid in full: half of the price is refunded if you can't attend.";

/** What to send back to a workshop client who can't attend: half the total if they paid it all, else nothing. */
export function workshopRefundCents(totalCents: number, paidCents: number): number {
  return paidCents >= totalCents && totalCents > 0 ? Math.round(totalCents / 2) : 0;
}

/** Whether people can sign up now: the admin has set a date, it hasn't started, and seats are left. */
export type WorkshopOpening =
  | { open: true; seatsLeft: number | null }
  | { open: false; reason: "no_date" | "started" | "full" };

export function workshopOpening(
  workshop: { workshop_starts_at: string | null; workshop_seats: number | null },
  seatsTaken: number,
  now: Date = new Date(),
): WorkshopOpening {
  if (!workshop.workshop_starts_at) return { open: false, reason: "no_date" };
  if (Date.parse(workshop.workshop_starts_at) <= now.getTime()) {
    return { open: false, reason: "started" };
  }
  if (workshop.workshop_seats === null) return { open: true, seatsLeft: null };
  const seatsLeft = Math.max(workshop.workshop_seats - seatsTaken, 0);
  return seatsLeft > 0 ? { open: true, seatsLeft } : { open: false, reason: "full" };
}

/**
 * "Saturday, 14 November 2026" and "1:00 PM – 5:30 PM", in Manila time. Uses
 * Intl rather than TZDate, which reads the clock and so can't run while the
 * home page is prerendered.
 */
export function formatWorkshopWhen(startsAt: string, endsAt: string) {
  const part = (iso: string, options: Intl.DateTimeFormatOptions) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, ...options })
        .formatToParts(new Date(iso))
        .map((p) => [p.type, p.value]),
    );
  const d = part(startsAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = (iso: string) => {
    const t = part(iso, { hour: "numeric", minute: "2-digit", hour12: true });
    return `${t.hour}:${t.minute} ${t.dayPeriod}`;
  };
  return {
    date: `${d.weekday}, ${d.day} ${d.month} ${d.year}`,
    time: `${time(startsAt)} – ${time(endsAt)}`,
  };
}

/** Per-person prices by category; null = that category isn't offered. Mirrors create_booking. */
export type WorkshopPrices = { regular: number; early_bird: number | null; student: number | null };

export function workshopPrices(workshop: {
  price_cents: number;
  workshop_early_bird_price_cents: number | null;
  workshop_student_price_cents: number | null;
}): WorkshopPrices {
  return {
    regular: workshop.price_cents,
    early_bird: workshop.workshop_early_bird_price_cents,
    student: workshop.workshop_student_price_cents,
  };
}

/** The workshop price (before VAT) for these people. */
export function attendeesCents(
  attendees: { category: keyof WorkshopPrices }[],
  prices: WorkshopPrices,
): number {
  return attendees.reduce((sum, a) => sum + (prices[a.category] ?? prices.regular), 0);
}

/**
 * Whether Early bird can still be picked: it has a price, today (Manila) is on
 * or before the last day, and early-bird places are left. `left` is null when
 * there's no cap.
 */
export function earlyBirdOpening(
  workshop: {
    workshop_early_bird_price_cents: number | null;
    workshop_early_bird_until: string | null;
    workshop_early_bird_seats: number | null;
  },
  taken: number,
  now: Date = new Date(),
): { open: boolean; left: number | null } {
  const left =
    workshop.workshop_early_bird_seats === null
      ? null
      : Math.max(workshop.workshop_early_bird_seats - taken, 0);
  // "YYYY-MM-DD" in Manila, comparable with the stored date.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(now);
  const open =
    workshop.workshop_early_bird_price_cents !== null &&
    (workshop.workshop_early_bird_until === null || today <= workshop.workshop_early_bird_until) &&
    (left === null || left > 0);
  return { open, left };
}

/** "31 January 2027" for an early-bird last day ("2027-01-31"). */
export function formatEarlyBirdUntil(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
  return `${d} ${month} ${y}`;
}
