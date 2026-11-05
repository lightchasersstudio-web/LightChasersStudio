/** Booking references look like BK-2026-1A2B3C (year + 6 hex digits). */
export const REFERENCE_RE = /^BK-\d{4}-[0-9A-F]{6}$/;

export type FinderQuery =
  { kind: "reference"; value: string } | { kind: "email"; value: string } | { kind: "invalid" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * What a visitor typed into "Find your booking": a reference (spaces, case and a
 * missing "BK-" are forgiven) or the email they booked with.
 */
export function parseFinderQuery(input: string): FinderQuery {
  const raw = input.trim();
  if (!raw) return { kind: "invalid" };
  if (raw.includes("@")) {
    const email = raw.toLowerCase();
    return EMAIL_RE.test(email) ? { kind: "email", value: email } : { kind: "invalid" };
  }
  const compact = raw.toUpperCase().replace(/[\s_.–—-]+/g, "");
  const m = /^(?:BK)?(\d{4})([0-9A-F]{6})$/.exec(compact);
  return m ? { kind: "reference", value: `BK-${m[1]}-${m[2]}` } : { kind: "invalid" };
}
