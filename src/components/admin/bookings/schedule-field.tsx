"use client";

import { TZDate } from "@date-fns/tz";
import { addMonths, format } from "date-fns";
import { useCallback, useState } from "react";
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { TextField } from "@/components/admin/form-fields";
import { SlotPicker } from "@/components/booking/slot-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { BUSINESS_TZ, businessDateTimeToIso } from "@/lib/utils/business-date";
import { getAdminMonthSlots } from "@/server/actions/admin-bookings";

/**
 * Date & time for staff: the free-times calendar, or "any time" date + time
 * inputs. When moving a booking, `excludeBookingId` keeps its own slot free.
 */
export function ScheduleField<
  F extends FieldValues & { date: string; time: string; serviceId: string },
  T extends FieldValues,
>({
  form,
  initialDate,
  startInAnyTime,
  excludeBookingId,
}: {
  form: UseFormReturn<F, unknown, T>;
  initialDate?: string | null;
  startInAnyTime?: boolean;
  excludeBookingId?: string;
}) {
  const [anyTime, setAnyTime] = useState(Boolean(startInAnyTime));
  const [serviceId, date, time] = useWatch({
    control: form.control,
    name: ["serviceId", "date", "time"] as Path<F>[],
  }) as unknown as [string, string, string];
  const now = TZDate.tz(BUSINESS_TZ);
  const loadMonth = useCallback(
    (month: string) => getAdminMonthSlots({ serviceId, month, excludeBookingId }),
    [serviceId, excludeBookingId],
  );
  const set = (name: "date" | "time", value: string) =>
    form.setValue(name as Path<F>, value as PathValue<F, Path<F>>, { shouldDirty: true });
  const error = form.formState.errors.date ?? form.formState.errors.time;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="link" className="px-0" onClick={() => setAnyTime((v) => !v)}>
          {anyTime ? "Show free times" : "Pick any time instead"}
        </Button>
      </div>
      {anyTime ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField control={form.control} name={"date" as Path<F>} label="Date" type="date" />
          <TextField
            control={form.control}
            name={"time" as Path<F>}
            label="Start time"
            type="time"
          />
        </div>
      ) : (
        <Field data-invalid={Boolean(error)}>
          <SlotPicker
            key={serviceId}
            load={loadMonth}
            minMonth={format(now, "yyyy-MM")}
            maxMonth={format(addMonths(now, 24), "yyyy-MM")}
            value={date && time ? businessDateTimeToIso(date, time) : null}
            initialDate={initialDate ?? undefined}
            onChange={(iso) => {
              const t = iso ? new TZDate(iso, BUSINESS_TZ) : null;
              set("date", t ? format(t, "yyyy-MM-dd") : "");
              set("time", t ? format(t, "HH:mm") : "");
            }}
          />
          {error && <FieldError errors={[error as { message?: string }]} />}
        </Field>
      )}
    </div>
  );
}
