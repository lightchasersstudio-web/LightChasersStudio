import { formatPeso } from "@/lib/utils/money";

// Extra charges after a shoot (Studio Policy Manual 3.2, 4.4, 5.1, 7.8; owner
// request 2026-11-12). Preset prices live in business_settings (before VAT, like
// the rescheduling fee); a charge is stored as a booking line, so it counts in
// the total, VAT and balance.

export type ChargePrices = {
  cleaning_fee_cents: number;
  backdrop_paper_yard_cents: number;
  extra_person_cents: number;
  storage_day_cents: number;
};

export const CHARGE_KINDS = [
  { value: "cleaning", label: "Cleaning fee", price: "cleaning_fee_cents", unit: null },
  {
    value: "backdrop_paper",
    label: "Backdrop paper",
    price: "backdrop_paper_yard_cents",
    unit: { one: "yard", many: "yards" },
  },
  {
    value: "extra_person",
    label: "Extra people",
    price: "extra_person_cents",
    unit: { one: "person", many: "people" },
  },
  {
    value: "storage",
    label: "Storage of left-behind items",
    price: "storage_day_cents",
    unit: { one: "day", many: "days" },
  },
  { value: "damage", label: "Damage", price: null, unit: null },
  { value: "other", label: "Other charge", price: null, unit: null },
] as const satisfies readonly {
  value: string;
  label: string;
  price: keyof ChargePrices | null;
  unit: { one: string; many: string } | null;
}[];

export type ChargeKind = (typeof CHARGE_KINDS)[number]["value"];
export const CHARGE_KIND_VALUES = CHARGE_KINDS.map((k) => k.value) as [ChargeKind, ...ChargeKind[]];

export const chargeKind = (kind: ChargeKind) => CHARGE_KINDS.find((k) => k.value === kind)!;

/** Damage and "other" have no preset price: staff type the amount and what it's for. */
export const chargeNeedsAmount = (kind: ChargeKind) => chargeKind(kind).price === null;

/**
 * The line added to the booking: its name (≤ 80 characters, what the client
 * sees) and price before VAT. Presets use the Settings price × quantity.
 */
export function chargeLine(
  input: { kind: ChargeKind; quantity: number; amountCents: number | null; note: string | null },
  prices: ChargePrices,
): { name: string; priceCents: number } {
  const k = chargeKind(input.kind);
  const note = input.note?.trim() || null;
  if (k.price === null) {
    const name = note ? `${k.label}: ${note}` : k.label;
    return { name: name.slice(0, 80), priceCents: input.amountCents ?? 0 };
  }
  const unitCents = prices[k.price];
  if (!k.unit) return { name: k.label, priceCents: unitCents };
  const qty = input.quantity;
  const name = `${k.label} × ${qty} ${qty === 1 ? k.unit.one : k.unit.many} (${formatPeso(unitCents)} per ${k.unit.one})`;
  return { name: name.slice(0, 80), priceCents: unitCents * qty };
}
