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
import { recordPayment, saveAdminNotes } from "@/server/actions/admin-bookings";

/** GCash or cash received outside the website (e.g. the balance on the day). */
export function RecordPaymentForm({ bookingId }: { bookingId: string }) {
  const form = useForm<RecordPaymentInput, unknown, z.output<typeof recordPaymentSchema>>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: { bookingId, provider: "gcash", amount: "", reference: "" },
  });

  async function onSubmit() {
    if (handleResult(await recordPayment(form.getValues()), "Payment recorded.", form)) {
      form.reset({ bookingId, provider: "gcash", amount: "", reference: "" });
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="grid gap-4 sm:grid-cols-[9rem_1fr_1fr_auto] sm:items-start"
    >
      <SelectField
        control={form.control}
        name="provider"
        label="Paid by"
        options={[
          { value: "gcash", label: "GCash" },
          { value: "cash", label: "Cash" },
        ]}
      />
      <TextField
        control={form.control}
        name="amount"
        label="Amount"
        prefix="₱"
        inputMode="decimal"
      />
      <TextField control={form.control} name="reference" label="Ref. no." placeholder="Optional" />
      <Button type="submit" className="sm:mt-7" disabled={form.formState.isSubmitting}>
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
