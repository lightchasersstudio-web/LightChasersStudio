"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, getDay, parseISO } from "date-fns";
import { CalendarCheckIcon, Loader2Icon, PencilIcon } from "lucide-react";
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
  hasTimes,
  isDayStatus,
  isShift,
  minutesWorked,
  type ShiftStatus,
} from "@/lib/payroll/cutoff";
import { isTimeOutEdited, SHIFTS, shiftTimeOut } from "@/lib/payroll/daily-pay";
import { amountToInput, formatAmount, parseAmount } from "@/lib/payroll/money";
import { cn } from "@/lib/utils";
import { attendanceSheetSchema, type AttendanceSheetInput } from "@/lib/validations/attendance";
import { saveAttendance } from "@/server/actions/attendance";
import type { AttendanceLog } from "@/server/queries/attendance";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "4h short" / "2h overtime" under a present day's hours, against a shift. */
function ShiftNote({ minutes, shift }: { minutes: number; shift: number }) {
  if (!minutes || minutes === shift) return null;
  const short = minutes < shift;
  return (
    <span className={cn("text-xs xl:block", short ? "text-terracotta-ink" : "text-primary")}>
      <span className="xl:hidden"> · </span>
      {formatMinutes(Math.abs(shift - minutes))} {short ? "short" : "overtime"}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  present: "",
  am: "",
  pm: "",
  am_pm: "",
  rest_day: "bg-muted/60",
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
  hoursPerDay,
  currentRate,
  amPmRate,
}: {
  employeeId: string;
  employeeName: string;
  cutoff: string;
  dates: string[];
  logs: AttendanceLog[];
  /** A shift: less is undertime, more is overtime. */
  hoursPerDay: number;
  /** The employee's daily rate today: new days start with it. */
  currentRate: number;
  /** Payroll settings → AM/PM shift rate: filled in when AM/PM is picked. */
  amPmRate: number;
}) {
  const shift = Math.round(hoursPerDay * 60);
  const currentRateInput = amountToInput(currentRate);
  const amPmRateInput = amountToInput(amPmRate);
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
        // Recorded days keep the rate they were saved with.
        rate: l ? amountToInput(l.dailyRate) : currentRateInput,
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
  const [fillOut, setFillOut] = useState("17:00");

  const minutesFor = (d: AttendanceSheetInput["days"][number] | undefined) =>
    d && hasTimes(d.status) && TIME.test(d.timeIn) && TIME.test(d.timeOut) && d.timeIn !== d.timeOut
      ? minutesWorked(d.timeIn, d.timeOut)
      : 0;
  const totals = dayTotals(
    (days ?? []).flatMap((d) =>
      isDayStatus(d.status) ? [{ status: d.status, minutes: minutesFor(d) }] : [],
    ),
  );
  // Against a shift, on present days with both times in (AM/PM are full days).
  const presentMinutes = (days ?? []).flatMap((d) =>
    d.status === "present" && minutesFor(d) > 0 ? [minutesFor(d)] : [],
  );
  const shortMinutes = presentMinutes.reduce((s, m) => s + Math.max(0, shift - m), 0);
  const overtimeMinutes = presentMinutes.reduce((s, m) => s + Math.max(0, m - shift), 0);

  const set = (path: Parameters<typeof form.setValue>[0], value: string) =>
    form.setValue(path, value, { shouldDirty: true });

  /**
   * Picking a shift always fills its times (AM 9:30–5:30, PM 2:00–10:00,
   * AM/PM 9:30–10:00), whatever the day had before; the admin can edit them after.
   */
  function startShift(i: number, status: ShiftStatus) {
    const timeIn = SHIFTS[status].start;
    set(`days.${i}.timeIn`, timeIn);
    set(`days.${i}.timeOut`, shiftTimeOut(timeIn, status) ?? "");
    form.clearErrors([`days.${i}.timeIn`, `days.${i}.timeOut`]);
  }

  function fillBlank() {
    if (!TIME.test(fillIn) || !TIME.test(fillOut) || fillIn === fillOut) {
      toast.error("Enter a time in and a different time out first.");
      return;
    }
    let filled = 0;
    form.getValues("days").forEach((d, i) => {
      if (d.status !== "" || getDay(parseISO(d.date)) === 0) return; // skip Sundays
      set(`days.${i}.status`, "present");
      set(`days.${i}.timeIn`, fillIn);
      set(`days.${i}.timeOut`, fillOut);
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
        toast.error("Some days need a time in, time out or rate."),
      )}
      noValidate
      className="space-y-4"
    >
      <div className="flex flex-col gap-3 rounded-3xl border bg-card p-4 xl:flex-row xl:items-end">
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm xl:max-w-xs xl:flex-1">
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
        <p className="text-sm text-muted-foreground xl:max-w-64">
          Fills Monday–Saturday days with nothing recorded yet. Sundays stay blank. AM (9:30–5:30),
          PM (2:00–10:00) and AM/PM (9:30–10:00, ₱{amountToInput(amPmRate)}) fill in their times.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border bg-card">
        <Table>
          <TableHeader className="max-xl:sr-only">
            <TableRow>
              <TableHead className="pl-5">Day</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time in</TableHead>
              <TableHead>Time out</TableHead>
              <TableHead className="pr-6 text-right">Hours</TableHead>
              <TableHead>Daily rate</TableHead>
              <TableHead className="pr-5">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, i) => {
              const d = days?.[i];
              const date = parseISO(field.date);
              const dayLabel = format(date, "EEE d MMM");
              const timed = hasTimes(d?.status ?? "");
              const sunday = getDay(date) === 0;
              const edited = d ? isTimeOutEdited(d.status, d.timeIn, d.timeOut) : false;
              const rate = parseAmount(d?.rate ?? "");
              const specialRate = timed && rate !== null && rate !== currentRate;
              return (
                <TableRow
                  key={field.id}
                  className={cn(
                    // Phones: each day is a small card (2 columns) instead of a wide row.
                    "grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 xl:table-row xl:p-0",
                    STATUS_TONE[d?.status ?? ""],
                  )}
                >
                  <TableCell className="self-center p-0 font-semibold xl:py-2 xl:pl-5">
                    <span className={cn(sunday && "text-muted-foreground")}>{dayLabel}</span>
                  </TableCell>
                  <TableCell className="p-0 xl:py-2">
                    <Controller
                      control={control}
                      name={`days.${i}.status`}
                      render={({ field: f }) => (
                        <NativeSelect
                          {...f}
                          aria-label={`Status, ${dayLabel}`}
                          className="w-full xl:w-36"
                          onChange={(e) => {
                            const previous = f.value;
                            f.onChange(e);
                            const next = e.target.value;
                            if (isShift(next)) {
                              startShift(i, next);
                            } else if (!hasTimes(next)) {
                              set(`days.${i}.timeIn`, "");
                              set(`days.${i}.timeOut`, "");
                              form.clearErrors([`days.${i}.timeIn`, `days.${i}.timeOut`]);
                            }
                            // AM/PM puts in the AM/PM rate (₱650); leaving it puts the
                            // employee's own rate back unless it was changed by hand.
                            const rate = form.getValues(`days.${i}.rate`).trim();
                            if (next === "am_pm") {
                              set(`days.${i}.rate`, amPmRateInput);
                            } else if (
                              next &&
                              (rate === "" || (previous === "am_pm" && rate === amPmRateInput))
                            ) {
                              set(`days.${i}.rate`, currentRateInput);
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
                    <TableCell key={name} className={cn("p-0 xl:py-2", !timed && "max-xl:hidden")}>
                      <Controller
                        control={control}
                        name={`days.${i}.${name}`}
                        render={({ field: f, fieldState }) => (
                          <div>
                            <span className="mb-1 block text-xs text-muted-foreground xl:sr-only">
                              {name === "timeIn" ? "Time in" : "Time out"}
                            </span>
                            <Input
                              {...f}
                              type="time"
                              disabled={!timed}
                              aria-label={`${name === "timeIn" ? "Time in" : "Time out"}, ${dayLabel}`}
                              aria-invalid={fieldState.invalid}
                              className="xl:w-32"
                              onChange={(e) => {
                                f.onChange(e);
                                // Shifts: a new time in moves the time out with it.
                                const status = form.getValues(`days.${i}.status`);
                                const out = isShift(status)
                                  ? shiftTimeOut(e.target.value, status)
                                  : null;
                                if (name === "timeIn" && out) {
                                  set(`days.${i}.timeOut`, out);
                                }
                              }}
                            />
                            {name === "timeOut" && edited && (
                              <span className="mt-1 flex items-center gap-1 text-xs text-terracotta-ink">
                                <PencilIcon className="size-3" aria-hidden />
                                Edited (not the usual times)
                              </span>
                            )}
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
                      "self-center p-0 text-sm tabular-nums xl:py-2 xl:pr-6 xl:text-right",
                      !timed && "max-xl:hidden",
                    )}
                  >
                    <span className="text-muted-foreground xl:hidden">Hours: </span>
                    {timed ? formatMinutes(minutesFor(d)) : "—"}
                    {d?.status === "present" && <ShiftNote minutes={minutesFor(d)} shift={shift} />}
                    {isShift(d?.status ?? "") && (
                      <span className="text-xs text-muted-foreground xl:block">
                        <span className="xl:hidden"> · </span>full day
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={cn("p-0 xl:py-2", !timed && "max-xl:hidden")}>
                    <Controller
                      control={control}
                      name={`days.${i}.rate`}
                      render={({ field: f, fieldState }) => (
                        <div className={cn(!timed && "xl:invisible")}>
                          <span className="mb-1 block text-xs text-muted-foreground xl:sr-only">
                            Daily rate
                          </span>
                          <div className="relative">
                            <span
                              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
                              aria-hidden
                            >
                              ₱
                            </span>
                            <Input
                              {...f}
                              inputMode="decimal"
                              autoComplete="off"
                              disabled={!timed}
                              aria-label={`Daily rate, ${dayLabel}`}
                              aria-invalid={fieldState.invalid}
                              className="pl-7 tabular-nums xl:w-28"
                            />
                          </div>
                          {specialRate && !fieldState.error && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Usual {formatAmount(currentRate)}
                            </span>
                          )}
                          {fieldState.error && (
                            <p role="alert" className="mt-1 text-xs text-destructive">
                              {fieldState.error.message}
                            </p>
                          )}
                        </div>
                      )}
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "col-span-2 p-0 xl:py-2 xl:pr-5",
                      !d?.note && !d?.status && "max-xl:hidden",
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
                          className="xl:min-w-40"
                        />
                      )}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter className="max-xl:block">
            <TableRow className="max-xl:block">
              <TableCell colSpan={7} className="px-4 py-3 xl:px-5">
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
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">Short</dt>
                    <dd className="font-semibold tabular-nums">{formatMinutes(shortMinutes)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">Overtime</dt>
                    <dd className="font-semibold tabular-nums">{formatMinutes(overtimeMinutes)}</dd>
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
