"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { SelectField, TextAreaField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { useUnsavedChangesWarning } from "@/components/admin/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import {
  adminNotesSchema,
  recordPaymentSchema,
  type RecordPaymentInput,
} from "@/lib/validations/admin-booking";
import { RECORDED_PROVIDERS } from "@/lib/payments/providers";
import { recordPayment, saveAdminNotes } from "@/server/actions/admin-bookings";

/** GCash, Maya, bank transfer or cash received outside the website (e.g. the balance on the day). */
export function RecordPaymentForm({
  bookingId,
  amount = "",
  stacked = false,
  onRecorded,
}: {
  bookingId: string;
  /** Pre-filled amount, e.g. the balance on the day. */
  amount?: string;
  /** One field per line (in a pop-up). */
  stacked?: boolean;
  onRecorded?: () => void;
}) {
  const form = useForm<RecordPaymentInput, unknown, z.output<typeof recordPaymentSchema>>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: { bookingId, provider: "gcash", amount, reference: "" },
  });

  async function onSubmit() {
    const result = await recordPayment(form.getValues());
    const message =
      result.ok && result.data.receiptEmailed
        ? "Payment recorded. The receipt was emailed to the client."
        : "Payment recorded.";
    if (handleResult(result, message, form)) {
      form.reset({ bookingId, provider: "gcash", amount: "", reference: "" });
      onRecorded?.();
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className={
        stacked ? "grid gap-4" : "grid gap-4 sm:grid-cols-[11rem_1fr_1fr_auto] sm:items-start"
      }
    >
      <SelectField
        control={form.control}
        name="provider"
        label="Paid by"
        options={[...RECORDED_PROVIDERS]}
      />
      <TextField
        control={form.control}
        name="amount"
        label="Amount"
        prefix="₱"
        inputMode="decimal"
      />
      <TextField control={form.control} name="reference" label="Ref. no." placeholder="Optional" />
      <Button
        type="submit"
        className={stacked ? undefined : "sm:mt-7"}
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
        Record payment
      </Button>
    </form>
  );
}

export function AdminNotesForm({ id, notes }: { id: string; notes: string | null }) {
  const form = useForm<
    z.input<typeof adminNotesSchema>,
    unknown,
    z.output<typeof adminNotesSchema>
  >({
    resolver: zodResolver(adminNotesSchema),
    defaultValues: { id, notes: notes ?? "" },
  });
  useUnsavedChangesWarning(form.formState.isDirty);
  return (
    <form
      onSubmit={form.handleSubmit(async () => {
        const values = form.getValues();
        if (handleResult(await saveAdminNotes(values), "Notes saved.", form)) form.reset(values);
      })}
      noValidate
      className="space-y-3"
    >
      <TextAreaField
        control={form.control}
        name="notes"
        label="Private notes"
        description="Only staff see these."
        rows={4}
        maxLength={5000}
      />
      <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
        Save notes
      </Button>
    </form>
  );
}
