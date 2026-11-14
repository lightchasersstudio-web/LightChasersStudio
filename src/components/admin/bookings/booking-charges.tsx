"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { SelectField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CHARGE_KINDS,
  chargeKind,
  chargeLine,
  chargeNeedsAmount,
  type ChargeKind,
  type ChargePrices,
} from "@/lib/booking/charges";
import { formatPeso, pesosToCents } from "@/lib/utils/money";
import { bookingChargeSchema, type BookingChargeInput } from "@/lib/validations/admin-booking";
import { addBookingCharge, removeBookingCharge } from "@/server/actions/admin-bookings";

type Line = { id: string; name: string; priceCents: number };

/**
 * Extra charges after a shoot (studio policy 3.2, 4.4, 5.1, 7.8) and the
 * rescheduling fee: booking lines that count in the total, VAT and balance.
 */
export function BookingCharges({
  bookingId,
  lines,
  prices,
  vatPercent,
  canAdd,
}: {
  bookingId: string;
  /** Lines that aren't catalogue add-ons (charges and rescheduling fees). */
  lines: Line[];
  prices: ChargePrices;
  /** The VAT % this booking pays (0 = no VAT). */
  vatPercent: number;
  canAdd: boolean;
}) {
  const [pending, start] = useTransition();
  if (!canAdd && lines.length === 0) return null;
  return (
    <div className="space-y-3 rounded-2xl bg-muted/60 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <strong>Extra charges</strong>{" "}
          <span className="text-muted-foreground">
            {vatPercent > 0 ? `before ${vatPercent}% VAT` : "no VAT on this booking"}
          </span>
        </p>
        {canAdd && <AddChargeDialog bookingId={bookingId} prices={prices} />}
      </div>
      {lines.length > 0 ? (
        <ul className="divide-y">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0">{l.name}</span>
              <span className="flex shrink-0 items-center gap-1">
                <strong>{formatPeso(l.priceCents)}</strong>
                {canAdd && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label={`Remove ${l.name}`}
                    onClick={() =>
                      start(async () => {
                        handleResult(
                          await removeBookingCharge({ bookingId, lineId: l.id }),
                          "Charge removed. The total and balance are updated.",
                        );
                      })
                    }
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">
          Cleaning, backdrop paper, extra people, storage or damage. None so far.
        </p>
      )}
    </div>
  );
}

function AddChargeDialog({ bookingId, prices }: { bookingId: string; prices: ChargePrices }) {
  const [open, setOpen] = useState(false);
  const form = useForm<BookingChargeInput, unknown, z.output<typeof bookingChargeSchema>>({
    resolver: zodResolver(bookingChargeSchema),
    defaultValues: { bookingId, kind: "cleaning", quantity: "1", amount: "", note: "" },
  });
  const [kind, quantity, amount, note] = useWatch({
    control: form.control,
    name: ["kind", "quantity", "amount", "note"],
  });
  const k = chargeKind(kind as ChargeKind);
  const needsAmount = chargeNeedsAmount(kind as ChargeKind);
  const qty = Math.max(1, Number.parseInt(quantity, 10) || 1);
  const preview = chargeLine(
    {
      kind: kind as ChargeKind,
      quantity: qty,
      amountCents: needsAmount ? pesosToCents(amount ?? "") : null,
      note: note ?? null,
    },
    prices,
  );

  // Send what was typed: the server checks it again with the same schema.
  async function onSubmit() {
    if (
      handleResult(
        await addBookingCharge(form.getValues()),
        "Charge added. The balance is updated.",
        form,
      )
    )
      setOpen(false);
  }

  const submitting = form.formState.isSubmitting;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) setOpen(next);
        if (next) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <PlusIcon aria-hidden />
          Add a charge
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>Add a charge</DialogTitle>
            <DialogDescription>
              Added to this booking&apos;s balance (plus VAT if the booking pays VAT). Preset prices
              are set in Settings → Extra charges.
            </DialogDescription>
          </DialogHeader>
          <SelectField
            control={form.control}
            name="kind"
            label="What for"
            options={CHARGE_KINDS.map((c) => ({
              value: c.value,
              label: c.price
                ? `${c.label} (${formatPeso(prices[c.price])}${c.unit ? ` per ${c.unit.one}` : ""})`
                : c.label,
            }))}
          />
          {k.unit && (
            <TextField
              control={form.control}
              name="quantity"
              label={`How many ${k.unit.many}`}
              inputMode="numeric"
              className="max-w-40"
              description={
                kind === "extra_person"
                  ? "People beyond the package limit (8 for hourly rentals)."
                  : kind === "storage"
                    ? "Days after the free 24 hours."
                    : undefined
              }
            />
          )}
          {needsAmount && (
            <>
              <TextField
                control={form.control}
                name="amount"
                label="Amount before VAT (₱)"
                inputMode="decimal"
                className="max-w-48"
                description={
                  kind === "damage"
                    ? "At least the booking's rental value or the repair cost, whichever is higher (policy 4.3)."
                    : undefined
                }
              />
              <TextField
                control={form.control}
                name="note"
                label="What it's for"
                maxLength={60}
                placeholder={kind === "damage" ? "Broken softbox" : "Describe the charge"}
              />
            </>
          )}
          <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
            Adds <strong>{formatPeso(preview.priceCents)}</strong>: {preview.name}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2Icon className="animate-spin" aria-hidden />}
              Add charge
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
