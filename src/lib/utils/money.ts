/** Money is stored as integer centavos (₱1 = 100). */

const phpWhole = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});
const phpCents = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

/** ₱1,500 for whole pesos, ₱1,500.50 otherwise. */
export function formatPeso(cents: number): string {
  return (cents % 100 === 0 ? phpWhole : phpCents).format(cents / 100);
}

/** "1,500.50" / "1500" → 150050 / 150000; null if not a valid non-negative amount. */
export function pesosToCents(input: string): number | null {
  const clean = input.replace(/[₱,\s]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** 150050 → "1500.50", 150000 → "1500" (for form inputs). */
export function centsToPesoInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
