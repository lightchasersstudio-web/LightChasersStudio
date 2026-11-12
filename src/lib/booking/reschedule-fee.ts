import { formatPeso } from "@/lib/utils/money";

/**
 * The notice clients see about moving a booking: "Rescheduling costs ₱500 + 12% VAT,
 * added to your balance." Null when the package has no fee.
 */
export function rescheduleFeeNotice(feeCents: number, vatPercent: number): string | null {
  if (feeCents <= 0) return null;
  const vat = vatPercent > 0 ? ` + ${vatPercent}% VAT` : "";
  return `Rescheduling costs ${formatPeso(feeCents)}${vat}, added to your balance.`;
}
