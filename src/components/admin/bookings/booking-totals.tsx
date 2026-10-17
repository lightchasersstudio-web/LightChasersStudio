"use client";

import { bookingTotals } from "@/lib/booking/pricing";
import { cn } from "@/lib/utils";
import { formatPeso, pesosToCents } from "@/lib/utils/money";
import type { AddOnLineInput } from "@/lib/validations/admin-booking";

/** Live total while staff edit a booking: package + add-ons (+ VAT), paid and balance. */
export function BookingTotals({
  packagePrice,
  addOns,
  vatPercent,
  chargeVat,
  paidCents,
}: {
  packagePrice: string;
  addOns: AddOnLineInput[];
  vatPercent: number;
  chargeVat: boolean;
  /** Omit for a new booking (nothing paid yet). */
  paidCents?: number;
}) {
  const { subtotal, vat, total } = bookingTotals({
    packageCents: pesosToCents(packagePrice) ?? 0,
    addOnsCents: addOns.reduce((sum, a) => sum + (pesosToCents(a.price) ?? 0), 0),
    vatPercent: chargeVat ? vatPercent : 0,
    fixedDepositCents: 0,
    depositPercent: 0,
  });
  const balance = paidCents === undefined ? null : total - paidCents;

  return (
    <dl
      aria-live="polite"
      className="grid gap-1.5 rounded-2xl bg-accent p-4 text-sm text-accent-foreground"
    >
      <Row label="Package + add-ons" value={formatPeso(subtotal)} />
      {vat > 0 && <Row label={`VAT (${vatPercent}%)`} value={`+ ${formatPeso(vat)}`} />}
      <Row label="Total" value={formatPeso(total)} strong />
      {paidCents !== undefined && <Row label="Paid so far" value={formatPeso(paidCents)} />}
      {balance !== null && (
        <Row
          label={balance < 0 ? "Overpaid: refund due" : "Balance"}
          value={formatPeso(Math.abs(balance))}
          strong
          warn={balance < 0}
        />
      )}
    </dl>
  );
}

function Row({
  label,
  value,
  strong,
  warn,
}: {
  label: string;
  value: string;
  strong?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={cn("flex justify-between gap-4", warn && "text-destructive")}>
      <dt>{label}</dt>
      <dd className={cn(strong && "font-heading text-lg font-semibold")}>{value}</dd>
    </div>
  );
}
