"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { CalendarOffIcon, Loader2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { Button } from "@/components/ui/button";
import { blackoutSchema, type BlackoutInput } from "@/lib/validations/availability";
import { addBlackoutDates, removeBlackoutDate } from "@/server/actions/availability";
import type { BlackoutDate } from "@/server/queries/availability";

export function BlackoutManager({
  blackouts,
  today,
}: {
  blackouts: BlackoutDate[];
  today: string;
}) {
  const form = useForm<BlackoutInput, unknown, z.output<typeof blackoutSchema>>({
    resolver: zodResolver(blackoutSchema),
    defaultValues: { from: "", to: "", reason: "", today },
  });

  async function onSubmit() {
    const { from, to, reason } = form.getValues();
    const result = await addBlackoutDates({ from, to, reason });
    if (
      handleResult(
        result,
        result.ok && result.data.added > 1 ? `Blocked ${result.data.added} days.` : "Date blocked.",
        form,
      )
    ) {
      form.reset({ from: "", to: "", reason: "", today });
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_auto] lg:items-start"
      >
        <TextField control={form.control} name="from" label="Date" type="date" min={today} />
        <TextField
          control={form.control}
          name="to"
          label="Until (optional)"
          type="date"
          min={today}
          description="For several days in a row."
        />
        <TextField
          control={form.control}
          name="reason"
          label="Reason (optional)"
          placeholder="e.g. Holy Week"
          maxLength={200}
          className="sm:col-span-2 lg:col-span-1"
        />
        <Button
          type="submit"
          size="lg"
          className="sm:col-span-2 lg:col-span-1 lg:mt-7"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          Block
        </Button>
      </form>

      {blackouts.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-dashed p-6 text-muted-foreground">
          <CalendarOffIcon className="size-5 text-terracotta" aria-hidden />
          No upcoming days off. Clients can book any day you&apos;re open.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {blackouts.map((b) => {
            const label = format(parseISO(b.date), "EEE, d MMM yyyy");
            return (
              <li
                key={b.id}
                className="flex items-center gap-3 rounded-2xl border bg-card py-2 pr-2 pl-4"
              >
                <CalendarOffIcon className="size-5 shrink-0 text-terracotta" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{label}</p>
                  {b.reason && <p className="truncate text-sm text-muted-foreground">{b.reason}</p>}
                </div>
                <ConfirmDelete
                  label={`Unblock ${label}`}
                  title={`Unblock ${label}?`}
                  description="Clients will be able to book this day again (within your opening hours)."
                  onConfirm={async () =>
                    handleResult(await removeBlackoutDate({ id: b.id }), "Date unblocked.")
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
