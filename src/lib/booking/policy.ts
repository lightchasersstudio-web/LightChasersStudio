import { formatPeso } from "@/lib/utils/money";

// Rescheduling & cancellation rules from the Studio Policy Manual (owner request
// 2026-11-12): a booking can be moved once, up to 48 hours before it starts (1.4);
// no refunds for cancellations (1.6) or no-shows (1.7); force majeure refunds
// everything paid (1.8). The database records the facts (cancelled_at,
// cancel_reason, rescheduled_at); these helpers turn them into wording.

export const STUDIO_POLICY_TITLE = "Studio Policy Manual & Client Agreement";

/**
 * Studio packages (booking type "studio") need the client to agree to the
 * studio policy on Review & pay; outside events, the Photobooth and workshops
 * don't (owner request 2026-11-14).
 */
export const needsStudioPolicy = (bookingCategory: string | null | undefined) =>
  bookingCategory === "studio";

/**
 * Things the studio must know at booking time (policy 3.8, 3.9, 7.4), asked on
 * the Shoot details step of studio packages and shown to staff.
 */
export const SHOOT_FLAGS = [
  {
    name: "sensitiveShoot",
    column: "sensitive_shoot",
    label: "This is a nude or sensitive shoot",
    hint: "We block out the whole date for you. Everyone photographed must be 18 or older.",
    staff: "Nude or sensitive shoot: block out the date, no behind-the-scenes content.",
  },
  {
    name: "petsOrMessy",
    column: "pets_or_messy",
    label: "We're bringing pets or messy materials",
    hint: "Glitter, body oil, flour, color powder or liquids. A refundable ₱2,000 security deposit is collected on the day.",
    staff: "Pets or messy materials: collect the ₱2,000 refundable security deposit.",
  },
  {
    name: "btsOptOut",
    column: "bts_opt_out",
    label: "Please leave us out of behind-the-scenes posts",
    hint: "We won't include you in photos or videos we share from the session.",
    staff: "Don't include them in behind-the-scenes posts.",
  },
] as const;

/** Rescheduling closes this many hours before the start (policy 1.4 and 1.6). */
export const RESCHEDULE_CUTOFF_HOURS = 48;

const HOUR = 3_600_000;

/** Hours from `at` until the booking starts (negative once it has started). */
export function hoursUntil(startAt: string, at: Date = new Date()): number {
  return (Date.parse(startAt) - at.getTime()) / HOUR;
}

/** Inside the last 48 hours before the start (or already started). */
export function pastRescheduleCutoff(startAt: string, at: Date = new Date()): boolean {
  return hoursUntil(startAt, at) < RESCHEDULE_CUTOFF_HOURS;
}

export type RescheduleBlock = "too_late" | "already_rescheduled";

/** Why the client can't ask to reschedule any more, or null if they still can. */
export function rescheduleBlock(
  b: { startAt: string; rescheduledAt: string | null },
  at: Date = new Date(),
): RescheduleBlock | null {
  if (b.rescheduledAt) return "already_rescheduled";
  if (pastRescheduleCutoff(b.startAt, at)) return "too_late";
  return null;
}

export const RESCHEDULE_BLOCK_MESSAGES: Record<RescheduleBlock, string> = {
  too_late: `Bookings can be rescheduled up to ${RESCHEDULE_CUTOFF_HOURS} hours before they start. Please message us if something came up.`,
  already_rescheduled:
    "This booking has already been rescheduled once, which is the limit. Please message us if something came up.",
};

export type CancelReason = "client" | "force_majeure";

export const CANCEL_REASONS: { value: CancelReason; label: string; hint: string }[] = [
  {
    value: "client",
    label: "The client cancelled",
    hint: "No refund: the down payment is kept.",
  },
  {
    value: "force_majeure",
    label: "We can't host it (force majeure)",
    hint: "Typhoon, flood, earthquake, power outage or a government order: everything paid is refunded in full.",
  },
];

export function asCancelReason(value: string | null | undefined): CancelReason | null {
  return value === "client" || value === "force_majeure" ? value : null;
}

/**
 * What the policy says before staff cancel: whether the client could reschedule
 * instead, and what happens to the money.
 */
export function cancelAdvice(
  reason: CancelReason,
  b: { startAt: string; paidCents: number; rescheduleFeeCents: number },
  at: Date = new Date(),
): string {
  const paid = formatPeso(b.paidCents);
  if (reason === "force_majeure") {
    return b.paidCents > 0
      ? `Refund everything paid (${paid}) in full, then mark the refund reviewed on this page. Offer a free reschedule first if they'd rather move.`
      : "Nothing has been paid, so there's nothing to refund. Offer a free reschedule if they'd rather move.";
  }
  const kept = b.paidCents > 0 ? `The ${paid} paid is kept, not refunded.` : "Nothing was paid.";
  if (pastRescheduleCutoff(b.startAt, at)) {
    return `Less than ${RESCHEDULE_CUTOFF_HOURS} hours before the shoot, so it can't be rescheduled. ${kept}`;
  }
  const fee = b.rescheduleFeeCents > 0 ? ` (${formatPeso(b.rescheduleFeeCents)} fee)` : "";
  return `It's more than ${RESCHEDULE_CUTOFF_HOURS} hours before the shoot, so they can reschedule instead${fee}. If they still cancel: ${kept}`;
}

/** The policy note shown on a cancelled or no-show booking (null for other statuses). */
export function closedBookingNote(
  b: {
    status: string;
    startAt: string;
    cancelledAt: string | null;
    cancelReason: CancelReason | null;
    paidCents: number;
  },
  audience: "staff" | "client",
): string | null {
  const paid = formatPeso(b.paidCents);
  const kept = b.paidCents > 0 ? `the ${paid} paid is kept and not refunded` : "nothing was paid";
  if (b.status === "no_show") {
    return audience === "staff"
      ? `No-show: ${kept}, and it can't be rescheduled. They're welcome to make a new booking.`
      : `This booking was marked as a no-show, so ${kept}. You're welcome to make a new booking any time.`;
  }
  if (b.status !== "cancelled" || !b.cancelReason) return null;
  if (b.cancelReason === "force_majeure") {
    if (b.paidCents === 0) return "Cancelled because we couldn't host it (force majeure).";
    return audience === "staff"
      ? `Cancelled for force majeure: refund everything paid (${paid}) in full.`
      : `We couldn't host this booking, so everything you paid (${paid}) will be refunded in full.`;
  }
  const late =
    b.cancelledAt !== null &&
    hoursUntil(b.startAt, new Date(b.cancelledAt)) < RESCHEDULE_CUTOFF_HOURS;
  const when = late
    ? `less than ${RESCHEDULE_CUTOFF_HOURS} hours before the start`
    : `${RESCHEDULE_CUTOFF_HOURS} hours or more before the start`;
  return audience === "staff"
    ? `Cancelled by the client ${when}: ${kept}.`
    : `This booking was cancelled ${when}, so ${kept}. You're welcome to make a new booking any time.`;
}
