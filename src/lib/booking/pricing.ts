/**
 * Online booking price, mirroring create_booking (which recomputes it on the
 * server): VAT on package + add-ons is added on top, and the default deposit %
 * applies to the VAT-inclusive total. A package's fixed deposit stays fixed.
 * Workshops (`payInFull` set) pay half or the whole total instead.
 */
export function bookingTotals(input: {
  packageCents: number;
  addOnsCents: number;
  vatPercent: number;
  /** The package's own fixed deposit, or null to use the default %. */
  fixedDepositCents: number | null;
  depositPercent: number;
  /** Workshops only: the client's choice to pay the full price (else half). */
  payInFull?: boolean;
}) {
  const subtotal = input.packageCents + input.addOnsCents;
  const vat = Math.round((subtotal * input.vatPercent) / 100);
  const total = subtotal + vat;
  const deposit =
    input.payInFull === undefined
      ? (input.fixedDepositCents ?? Math.round((total * input.depositPercent) / 100))
      : input.payInFull
        ? total
        : Math.round(total / 2);
  return { subtotal, vat, total, deposit };
}

/** Down payment % per group (owner request 2026-11-12): events vs everything else. */
export type DepositPercents = { studio: number; events: number };

export function depositPercents(settings: {
  default_deposit_percent: number;
  events_deposit_percent: number;
}): DepositPercents {
  return { studio: settings.default_deposit_percent, events: settings.events_deposit_percent };
}

/** Mirrors public.deposit_percent_for(): `services.deposit_group` picks the %. */
export function depositPercentFor(group: string | null | undefined, percents: DepositPercents) {
  return group === "events" ? percents.events : percents.studio;
}
