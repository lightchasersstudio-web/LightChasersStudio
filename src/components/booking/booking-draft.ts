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
  "sensitiveShoot",
  "petsOrMessy",
  "btsOptOut",
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

/**
 * A returning client's own details (name, email, number, how to reach them),
 * kept in this browser after they book so the next booking starts filled in.
 * "Not you?" on the form forgets them.
 */
const CLIENT_KEY = "lcs:client";
const CLIENT_FIELDS = ["fullName", "email", "phone", "preferredContact", "messenger"] as const;
export type ClientDetails = Partial<Pick<PublicBookingInput, (typeof CLIENT_FIELDS)[number]>>;

export function saveClientDetails(values: Partial<PublicBookingInput>) {
  const details: ClientDetails = {};
  for (const field of CLIENT_FIELDS) {
    if (values[field] !== undefined) Object.assign(details, { [field]: values[field] });
  }
  try {
    localStorage.setItem(CLIENT_KEY, JSON.stringify(details));
  } catch {
    // Storage blocked: they just type their details again next time.
  }
}

export function loadClientDetails(): ClientDetails | null {
  try {
    const saved = JSON.parse(localStorage.getItem(CLIENT_KEY) ?? "null") as ClientDetails | null;
    return saved?.fullName && saved.email ? saved : null;
  } catch {
    return null;
  }
}

export function forgetClientDetails() {
  try {
    localStorage.removeItem(CLIENT_KEY);
  } catch {
    // ignore
  }
}
