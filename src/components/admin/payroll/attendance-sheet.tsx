"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, getDay, parseISO } from "date-fns";
import { CalendarCheckIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { handleResult } from "@/components/admin/form-utils";
import { useUnsavedChangesWarning } from "@/components/admin/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DAY_STATUSES,
  dayTotals,
  formatMinutes,
  isDayStatus,
  minutesWorked,
} from "@/lib/payroll/cutoff";
import { cn } from "@/lib/utils";
import { attendanceSheetSchema, type AttendanceSheetInput } from "@/lib/validations/attendance";
import { saveAttendance } from "@/server/actions/attendance";
import type { AttendanceLog } from "@/server/queries/attendance";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const STATUS_TONE: Record<string, string> = {
  present: "",
  absent: "bg-destructive/5",
  leave: "bg-blush/50",
  holiday: "bg-sage/15",
};

export function AttendanceSheet({
  employeeId,
  employeeName,
  cutoff,
  dates,
  logs,
}: {
  employeeId: string;
  employeeName: string;
  cutoff: string;
  dates: string[];
  logs: AttendanceLog[];
}) {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const defaults: AttendanceSheetInput = {
    employeeId,
    cutoff,
    days: dates.map((date) => {
      const l = byDate.get(date);
      return {
        date,
        status: l?.status ?? "",
        timeIn: l?.timeIn ?? "",
        timeOut: l?.timeOut ?? "",
        note: l?.note ?? "",
      };
    }),
  };
  const form = useForm<AttendanceSheetInput, unknown, z.output<typeof attendanceSheetSchema>>({
    resolver: zodResolver(attendanceSheetSchema),
    defaultValues: defaults,
  });
  const { control } = form;
  const { fields } = useFieldArray({ control, name: "days" });
  const days = useWatch({ control, name: "days" });
  useUnsavedChangesWarning(form.formState.isDirty);

  const [fillIn, setFillIn] = useState("09:00");
  const [fillOut, setFillOut] = useState("18:00");

  const minutesFor = (d: AttendanceSheetInput["days"][number] | undefined) =>
    d?.status === "present" && TIME.test(d.timeIn) && TIME.test(d.timeOut) && d.timeIn !== d.timeOut
      ? minutesWorked(d.timeIn, d.timeOut)
      : 0;
  const totals = dayTotals(
    (days ?? []).flatMap((d) =>
      isDayStatus(d.status) ? [{ status: d.status, minutes: minutesFor(d) }] : [],
    ),
  );

  function fillBlank() {
    if (!TIME.test(fillIn) || !TIME.test(fillOut) || fillIn === fillOut) {
      toast.error("Enter a time in and a different time out first.");
      return;
    }
    let filled = 0;
    form.getValues("days").forEach((d, i) => {
      if (d.status !== "" || getDay(parseISO(d.date)) === 0) return; // skip Sundays
      form.setValue(`days.${i}.status`, "present", { shouldDirty: true });
      form.setValue(`days.${i}.timeIn`, fillIn, { shouldDirty: true });
      form.setValue(`days.${i}.timeOut`, fillOut, { shouldDirty: true });
      filled += 1;
    });
    toast(filled ? `Filled ${filled} days. Save to keep them.` : "No blank Monday–Saturday left.");
  }

  async function onSubmit() {
    const values = form.getValues();
    const result = await saveAttendance(values);
    if (handleResult(result, `Time record saved for ${employeeName}.`, form)) form.reset(values);
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, () =>
        toast.error("Some days need a time in and time out."),
      )}
      noValidate
      className="space-y-4"
    >
      <div className="flex flex-col gap-3 rounded-3xl border bg-card p-4 sm:flex-row sm:items-end">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:max-w-xs">
          <div className="grid gap-1.5">
            <Label htmlFor="fill-in">Usual time in</Label>
            <Input
              id="fill-in"
              type="time"
              value={fillIn}
              onChange={(e) => setFillIn(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fill-out">Usual time out</Label>
            <Input
              id="fill-out"
              type="time"
              value={fillOut}
              onChange={(e) => setFillOut(e.target.value)}
            />
          </div>
        </div>
        <Button type="button" variant="outline" onClick={fillBlank}>
          <CalendarCheckIcon aria-hidden />
          Mark blank days present
        </Button>
        <p className="text-sm text-muted-foreground sm:max-w-56">
          Fills Monday–Saturday days with nothing recorded yet. Sundays stay blank.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border bg-card">
        <Table>
          <TableHeader className="max-md:sr-only">
            <TableRow>
              <TableHead className="pl-5">Day</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time in</TableHead>
              <TableHead>Time out</TableHead>
              <TableHead className="pr-6 text-right">Hours</TableHead>
              <TableHead className="pr-5">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, i) => {
              const d = days?.[i];
              const date = parseISO(field.date);
              const dayLabel = format(date, "EEE d MMM");
              const present = d?.status === "present";
              const sunday = getDay(date) === 0;
              return (
                <TableRow
                  key={field.id}
                  className={cn(
                    // Phones: each day is a small card (2 columns) instead of a wide row.
                    "grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 md:table-row md:p-0",
                    STATUS_TONE[d?.status ?? ""],
                  )}
                >
                  <TableCell className="self-center p-0 font-semibold md:py-2 md:pl-5">
                    <span className={cn(sunday && "text-muted-foreground")}>{dayLabel}</span>
                  </TableCell>
                  <TableCell className="p-0 md:py-2">
                    <Controller
                      control={control}
                      name={`days.${i}.status`}
                      render={({ field: f }) => (
                        <NativeSelect
                          {...f}
                          aria-label={`Status, ${dayLabel}`}
                          className="w-full md:w-36"
                          onChange={(e) => {
                            f.onChange(e);
                            if (e.target.value !== "present") {
                              form.setValue(`days.${i}.timeIn`, "", { shouldDirty: true });
                              form.setValue(`days.${i}.timeOut`, "", { shouldDirty: true });
                              form.clearErrors([`days.${i}.timeIn`, `days.${i}.timeOut`]);
                            }
                          }}
                        >
                          <NativeSelectOption value="">Not recorded</NativeSelectOption>
                          {DAY_STATUSES.map((s) => (
                            <NativeSelectOption key={s.value} value={s.value}>
                              {s.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      )}
                    />
                  </TableCell>
                  {(["timeIn", "timeOut"] as const).map((name) => (
                    <TableCell
                      key={name}
                      className={cn("p-0 md:py-2", !present && "max-md:hidden")}
                    >
                      <Controller
                        control={control}
                        name={`days.${i}.${name}`}
                        render={({ field: f, fieldState }) => (
                          <div>
                            <span className="mb-1 block text-xs text-muted-foreground md:sr-only">
                              {name === "timeIn" ? "Time in" : "Time out"}
                            </span>
                            <Input
                              {...f}
                              type="time"
                              disabled={!present}
                              aria-label={`${name === "timeIn" ? "Time in" : "Time out"}, ${dayLabel}`}
                              aria-invalid={fieldState.invalid}
                              className="md:w-32"
                            />
                            {fieldState.error && (
                              <p role="alert" className="mt-1 text-xs text-destructive">
                                {fieldState.error.message}
                              </p>
                            )}
                          </div>
                        )}
                      />
                    </TableCell>
                  ))}
                  <TableCell
                    className={cn(
                      "self-center p-0 text-sm tabular-nums md:py-2 md:pr-6 md:text-right",
                      !present && "max-md:hidden",
                    )}
                  >
                    <span className="text-muted-foreground md:hidden">Hours: </span>
                    {present ? formatMinutes(minutesFor(d)) : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "col-span-2 p-0 md:py-2 md:pr-5",
                      !d?.note && !d?.status && "max-md:hidden",
                    )}
                  >
                    <Controller
                      control={control}
                      name={`days.${i}.note`}
                      render={({ field: f }) => (
                        <Input
                          {...f}
                          maxLength={200}
                          placeholder="Note"
                          aria-label={`Note, ${dayLabel}`}
                          className="md:min-w-40"
                        />
                      )}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter className="max-md:block">
            <TableRow className="max-md:block">
              <TableCell colSpan={6} className="px-4 py-3 md:px-5">
                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {DAY_STATUSES.map((s) => (
                    <div key={s.value} className="flex gap-1.5">
                      <dt className="text-muted-foreground">{s.label}</dt>
                      <dd className="font-semibold tabular-nums">{totals[s.value]}</dd>
                    </div>
                  ))}
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">Hours worked</dt>
                    <dd className="font-semibold tabular-nums">{formatMinutes(totals.minutes)}</dd>
                  </div>
                </dl>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button
          type="submit"
          size="lg"
          className="shadow-lg"
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
        >
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          Save time record
        </Button>
      </div>
    </form>
  );
}
