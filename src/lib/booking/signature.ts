/** "  ana   CRUZ " → "ana cruz" (how signatures are compared). */
const normalise = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Whether the typed signature is the client's full name as given on the
 * Details step (spacing and capital letters don't matter).
 */
export function signatureMatches(signature: string | undefined, fullName: string): boolean {
  const typed = normalise(signature ?? "");
  return typed.length >= 2 && typed === normalise(fullName);
}

/** The name kept with the booking: as typed, with extra spaces removed. */
export const cleanSignature = (signature: string) => signature.trim().replace(/\s+/g, " ");
