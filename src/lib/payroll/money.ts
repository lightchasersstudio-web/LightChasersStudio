import { centsToPesoInput, formatPeso, pesosToCents } from "@/lib/utils/money";

// Payroll stores money as numeric(12,2) pesos (owner decision), unlike the
// rest of the app's integer centavos. Sums are worked out in centavos so
// they never pick up floating-point drift, then turned back into pesos.

/** 1500.5 → 150050 */
export const toCents = (pesos: number): number => Math.round(pesos * 100);

/** 150050 → 1500.5 */
export const toPesos = (cents: number): number => Math.round(cents) / 100;

/** ₱1,500 / ₱1,500.50 */
export const formatAmount = (pesos: number): string => {
  const cents = toCents(pesos);
  return cents < 0 ? `−${formatPeso(-cents)}` : formatPeso(cents);
};

/** Always two decimals (₱1,500.00), for payslips and tables. */
const exact = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
export const formatAmountExact = (pesos: number): string => {
  const cents = toCents(pesos);
  return cents < 0 ? `−${exact.format(-cents / 100)}` : exact.format(cents / 100);
};

/** Typed "1,500.50" → 1500.5, or null if it isn't an amount. */
export function parseAmount(input: string): number | null {
  const cents = pesosToCents(input);
  return cents === null ? null : toPesos(cents);
}

/** 1500.5 → "1500.50" for a form input. */
export const amountToInput = (pesos: number): string => centsToPesoInput(toCents(pesos));
