"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CopyIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Controller, useFieldArray, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { handleResult } from "@/components/admin/form-utils";
import { useUnsavedChangesWarning } from "@/components/admin/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WEEKDAYS } from "@/lib/catalog";
import { weeklyHoursSchema, type WeeklyHoursInput } from "@/lib/validations/availability";
import { saveWeeklyHours } from "@/server/actions/availability";
import type { AvailabilityRule } from "@/server/queries/availability";

type Form = UseFormReturn<WeeklyHoursInput, unknown, z.output<typeof weeklyHoursSchema>>;

// Show Monday first; day_of_week stays 0 = Sunday in the data.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function WeeklyHoursForm({ rules }: { rules: AvailabilityRule[] }) {
  const form: Form = useForm({
    resolver: zodResolver(weeklyHoursSchema),
    defaultValues: {
      days: WEEKDAYS.map((_, d) => {
        const windows = rules
          .filter((r) => r.day_of_week === d)
          .map((r) => ({ start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) }));
        return { open: windows.length > 0, windows };
      }),
    },
  });
  useUnsavedChangesWarning(form.formState.isDirty);

  async function onSubmit() {
    const values = form.getValues();
    if (handleResult(await saveWeeklyHours(values), "Opening hours saved.", form))
      form.reset(values);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <ul className="divide-y rounded-2xl border bg-card">
        {DISPLAY_ORDER.map((d) => (
          <DayRow key={d} day={d} form={form} />
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
        >
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          Save opening hours
        </Button>
      </div>
    </form>
  );
}

function DayRow({ day, form }: { day: number; form: Form }) {
  const { control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: `days.${day}.windows` });
  const open = useWatch({ control, name: `days.${day}.open` });
  const name = WEEKDAYS[day];
  const dayErrors = form.formState.errors.days?.[day]?.windows;
  const dayMessage = dayErrors?.message ?? dayErrors?.root?.message;

  function copyToAll() {
    const source = form.getValues(`days.${day}`);
    WEEKDAYS.forEach((_, d) => {
      if (d !== day) {
        form.setValue(`days.${d}`, structuredClone(source), { shouldDirty: true });
      }
    });
    toast.success(`Copied ${name}'s hours to every day.`);
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      <div className="flex items-center justify-between gap-3 sm:w-44 sm:shrink-0 sm:pt-2.5">
        <label className="flex items-center gap-3 font-semibold">
          <Controller
            control={control}
            name={`days.${day}.open`}
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={(v) => {
                  field.onChange(v);
                  if (v && fields.length === 0) append({ start: "09:00", end: "17:00" });
                }}
              />
            )}
          />
          {name}
        </label>
        {!open && <span className="text-sm text-muted-foreground sm:hidden">Closed</span>}
      </div>

      <div className="flex-1 space-y-2">
        {!open && <p className="hidden pt-2.5 text-sm text-muted-foreground sm:block">Closed</p>}
        {open &&
          fields.map((f, i) => {
            const errs = form.formState.errors.days?.[day]?.windows?.[i];
            return (
              <div key={f.id}>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    aria-label={`${name} opens`}
                    className="w-full sm:w-36"
                    aria-invalid={Boolean(errs?.start)}
                    {...form.register(`days.${day}.windows.${i}.start`)}
                  />
                  <span className="text-muted-foreground" aria-hidden>
                    –
                  </span>
                  <Input
                    type="time"
                    aria-label={`${name} closes`}
                    className="w-full sm:w-36"
                    aria-invalid={Boolean(errs?.end)}
                    {...form.register(`days.${day}.windows.${i}.end`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${name} hours ${i + 1}`}
                    onClick={() => remove(i)}
                  >
                    <XIcon aria-hidden />
                  </Button>
                </div>
                {(errs?.start || errs?.end) && (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    {errs.start?.message ?? errs.end?.message}
                  </p>
                )}
              </div>
            );
          })}
        {open && dayMessage && (
          <p role="alert" className="text-sm text-destructive">
            {dayMessage}
          </p>
        )}
        {open && (
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => append({ start: "13:00", end: "17:00" })}
            >
              <PlusIcon aria-hidden />
              Add hours
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={copyToAll}>
              <CopyIcon aria-hidden />
              Copy to all days
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
