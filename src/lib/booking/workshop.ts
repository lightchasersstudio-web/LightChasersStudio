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
