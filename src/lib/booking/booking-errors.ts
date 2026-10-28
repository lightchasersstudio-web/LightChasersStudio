/** Friendly text for the P0001 codes raised by create_booking / admin_create_booking. */
export const BOOKING_ERRORS: Record<string, string> = {
  slot_unavailable: "That time was just taken. Please pick another.",
  too_soon: "That time is too soon to book online. Please pick a later time.",
  too_far: "That date is too far ahead to book yet.",
  blackout_date: "We're closed that day. Please pick another date.",
  outside_business_hours: "That time is outside our opening hours.",
  service_unavailable: "That package isn't available to book right now.",
  add_on_unavailable:
    "One of the add-ons you picked is no longer offered. Please check them again.",
  invalid_start_time: "Please pick one of the listed times.",
  email_required: "Enter a valid email address.",
  payment_option_required: "Choose to pay half or the full price.",
  workshop_not_scheduled: "The workshop's date hasn't been announced yet. Please check back soon.",
  invalid_participants: "A workshop sign-up is for 1 to 3 people.",
  invalid_attendees: "Enter the full name of everyone joining, for their certificates.",
  workshop_closed: "Sign-ups for this workshop have closed.",
  workshop_full:
    "Sorry, the workshop is fully booked (or doesn't have enough seats left for everyone).",
  invalid_price: "Enter a valid price.",
  invalid_payment: "Pick GCash or cash for the payment.",
  invalid_add_ons: "Check the add-ons: each needs a name (2–80 letters) and a price.",
  booking_not_editable: "Only bookings that need your OK or are confirmed can be changed.",
  booking_not_found: "That booking no longer exists.",
  booking_has_payments:
    "This booking has real payments, so it can't be deleted. Cancel it instead (and refund if needed).",
};

/** The booking error code inside a Postgres error message, if any. */
export function bookingErrorCode(message: string | undefined): string | null {
  return Object.keys(BOOKING_ERRORS).find((code) => message?.includes(code)) ?? null;
}
