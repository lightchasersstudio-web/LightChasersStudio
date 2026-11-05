import type { PublicBookingInput } from "@/lib/validations/booking";

/**
 * A half-finished booking kept in this browser only, so closing the tab doesn't
 * lose what the client typed. Never the chosen time (it may be taken by then),
 * the privacy consent (asked again) or the security token. Kept for 7 days and
 * cleared once the booking is sent.
 */
const KEY = "lcs:booking-draft";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const FIELDS = [
  "fullName",
  "email",
  "phone",
  "preferredContact",
  "messenger",
  "serviceId",
  "addOnIds",
  "location",
  "participants",
  "specialRequests",
] as const satisfies readonly (keyof PublicBookingInput)[];

export type BookingDraft = Partial<Pick<PublicBookingInput, (typeof FIELDS)[number]>>;

export function loadDraft(): BookingDraft | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
      savedAt: number;
      values: BookingDraft;
    } | null;
    if (!saved || Date.now() - saved.savedAt > MAX_AGE_MS) return null;
    return saved.values;
  } catch {
    return null;
  }
}

export function saveDraft(values: Partial<PublicBookingInput>) {
  // Nothing worth keeping until they've typed something about themselves.
  if (!values.fullName && !values.email && !values.phone) return;
  const draft: BookingDraft = {};
  for (const field of FIELDS) {
    if (values[field] !== undefined) Object.assign(draft, { [field]: values[field] });
  }
  try {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), values: draft }));
  } catch {
    // Private mode or storage full: the form still works, it just isn't remembered.
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
