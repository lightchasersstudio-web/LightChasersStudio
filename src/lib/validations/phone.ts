/**
 * A complete mobile number we can call or text.
 * - Philippine mobiles: 0917 123 4567, +63 917 123 4567, 63 917… or 917 123 4567
 *   (always 10 digits after the 0 / 63).
 * - Other countries: written with a leading + and country code, 8–15 digits.
 * Spaces, dashes, dots and brackets are fine.
 */
export function isCompleteMobile(value: string): boolean {
  const v = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, "");
  if (v.startsWith("+") && !digits.startsWith("63")) {
    return digits.length >= 8 && digits.length <= 15;
  }
  return /^(?:0|63)?9\d{9}$/.test(digits);
}

export const MOBILE_ERROR = "Enter the complete mobile number, like 0917 123 4567 (11 digits).";
