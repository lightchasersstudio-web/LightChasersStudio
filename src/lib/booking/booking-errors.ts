/** Friendly text for the P0001 codes raised by create_booking / admin_create_booking. */
export const BOOKING_ERRORS: Record<string, string> = {
  slot_unavailable: "That time was just taken. Please pick another.",
  too_soon: "That time is too soon to book online. Please pick a later time.",
  too_far: "That date is too far ahead to book yet.",
  blackout_date: "We're closed that day. Please pick another date.",
  outside_business_hours: "That time is outside our opening hours.",
  service_unavailable: "That package isn't available to book right now.",
  invalid_start_time: "Please pick one of the listed times.",
  email_required: "Enter a valid email address.",
  invalid_price: "Enter a valid price.",
  invalid_payment: "Pick GCash or cash for the payment.",
};

/** The booking error code inside a Postgres error message, if any. */
export function bookingErrorCode(message: string | undefined): string | null {
  return Object.keys(BOOKING_ERRORS).find((code) => message?.includes(code)) ?? null;
}
