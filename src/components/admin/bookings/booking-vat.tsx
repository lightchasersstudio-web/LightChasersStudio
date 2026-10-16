"use client";

import { ReceiptTextIcon } from "lucide-react";
import { useOptimistic, useTransition } from "react";

import { handleResult } from "@/components/admin/form-utils";
import { Switch } from "@/components/ui/switch";
import { formatPeso } from "@/lib/utils/money";
import { setBookingVat } from "@/server/actions/admin-bookings";

/** Charge or waive VAT on this booking only (e.g. a friend's booking without VAT). */
export function BookingVat({
  bookingId,
  vatCents,
  beforeVatCents,
  vatPercent,
  disabled,
}: {
  bookingId: string;
  vatCents: number;
  beforeVatCents: number;
  vatPercent: number;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [charged, setCharged] = useOptimistic(vatCents > 0);
  const wouldBe = Math.round((beforeVatCents * vatPercent) / 100);

  function toggle(chargeVat: boolean) {
    startTransition(async () => {
      setCharged(chargeVat);
      handleResult(
        await setBookingVat({ id: bookingId, chargeVat }),
        chargeVat
          ? "VAT added. The total and balance are updated."
          : "VAT removed from this booking. The total and balance are updated.",
      );
    });
  }

  const canAdd = vatPercent > 0 && wouldBe > 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3 text-sm">
      <div className="flex min-w-0 items-start gap-2.5">
        <ReceiptTextIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
        <p id={`vat-${bookingId}`}>
          {charged ? (
            <>
              <strong>VAT charged:</strong> {formatPeso(vatCents > 0 ? vatCents : wouldBe)}{" "}
              <span className="text-muted-foreground">
                on {formatPeso(beforeVatCents)} before VAT
              </span>
            </>
          ) : (
            <>
              <strong>No VAT on this booking.</strong>{" "}
              {canAdd && (
                <span className="text-muted-foreground">
                  Adding {vatPercent}% would add {formatPeso(wouldBe)}.
                </span>
              )}
            </>
          )}
        </p>
      </div>
      <label className="flex min-h-11 items-center gap-2 font-semibold">
        <Switch
          checked={charged}
          onCheckedChange={toggle}
          disabled={pending || disabled || (!charged && !canAdd)}
          aria-describedby={`vat-${bookingId}`}
        />
        Charge VAT
      </label>
    </div>
  );
}
