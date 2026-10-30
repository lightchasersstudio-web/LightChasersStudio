// Package lengths and add-on rules, mirroring booking_length_minutes() and the
// add-on checks in create_booking (the database stays the final word).

/**
 * How long a booking holds the calendar before the buffer. Packages with a set
 * length (the Photobooth): length + time-adding add-ons. Others have no end
 * time and hold just their start slot.
 */
export function bookingLengthMinutes(
  durationMinutes: number | null,
  extraMinutes: number,
  slotIntervalMinutes: number,
): number {
  return durationMinutes === null ? slotIntervalMinutes : durationMinutes + extraMinutes;
}

/** Whether an add-on is offered with a package (no packages listed = all of them). */
export function addOnOffered(addOn: { service_ids: string[] }, serviceId: string): boolean {
  return addOn.service_ids.length === 0 || addOn.service_ids.includes(serviceId);
}

/** End of a booking with a set length, or null when the package has none. */
export function sessionEndAt(
  startAt: string,
  durationMinutes: number | null,
  extraMinutes: number,
): string | null {
  if (durationMinutes === null) return null;
  return new Date(Date.parse(startAt) + (durationMinutes + extraMinutes) * 60_000).toISOString();
}
