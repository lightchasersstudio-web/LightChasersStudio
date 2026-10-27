/** Owner's refund rule for workshops (2026-10-27); refunds are sent by hand. */
export const WORKSHOP_REFUND_RULE =
  "Paid half: no refund if you can't attend. Paid in full: half of the price is refunded if you can't attend.";

/** What to send back to a workshop client who can't attend: half the total if they paid it all, else nothing. */
export function workshopRefundCents(totalCents: number, paidCents: number): number {
  return paidCents >= totalCents && totalCents > 0 ? Math.round(totalCents / 2) : 0;
}
