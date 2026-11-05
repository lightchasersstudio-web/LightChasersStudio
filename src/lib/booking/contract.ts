import "server-only";

import { createHash } from "node:crypto";

/** A package's contract, or null when it has none (empty or only spaces). */
export const packageContract = (text: string | null | undefined): string | null =>
  text?.trim() ? text.trim() : null;

/**
 * Fingerprint of the contract wording the client was shown. The booking form
 * sends it back so the server can tell if the contract changed in between.
 */
export const contractHash = (text: string): string =>
  createHash("sha256").update(text).digest("hex").slice(0, 32);

/** What the booking form needs: the wording and its fingerprint (or nulls). */
export function contractForWizard(text: string | null | undefined) {
  const contract = packageContract(text);
  return { contract, contractHash: contract ? contractHash(contract) : null };
}
