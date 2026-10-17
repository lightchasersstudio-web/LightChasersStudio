/**
 * Online booking price, mirroring create_booking (which recomputes it on the
 * server): VAT on package + add-ons is added on top, and the default deposit %
 * applies to the VAT-inclusive total. A package's fixed deposit stays fixed.
 */
export function bookingTotals(input: {
  packageCents: number;
  addOnsCents: number;
  vatPercent: number;
  /** The package's own fixed deposit, or null to use the default %. */
  fixedDepositCents: number | null;
  depositPercent: number;
}) {
  const subtotal = input.packageCents + input.addOnsCents;
  const vat = Math.round((subtotal * input.vatPercent) / 100);
  const total = subtotal + vat;
  const deposit = input.fixedDepositCents ?? Math.round((total * input.depositPercent) / 100);
  return { subtotal, vat, total, deposit };
}
