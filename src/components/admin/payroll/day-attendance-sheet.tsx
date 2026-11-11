"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, parseISO } from "date-fns";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarCheckIcon,
  Loader2Icon,
  MoonIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { handleResult } from "@/components/admin/form-utils";
import { ShiftNote } from "@/components/admin/payroll/attendance-sheet";
import { useUnsavedChangesWarning } from "@/components/admin/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  cutoffFor,
  DAY_STATUSES,
  formatMinutes,
  hasTimes,
  isShift,
  minutesWorked,
  type DayStatus,
} from "@/lib/payroll/cutoff";
import { isTimeOutEdited } from "@/lib/payroll/daily-pay";
import { afterStatusChange, timeOutForNewTimeIn } from "@/lib/payroll/day-entry";
import { amountToInput, formatAmount, parseAmount } from "@/lib/payroll/money";
import { cn } from "@/lib/utils";
import { attendanceDaySchema, type AttendanceTeamDayInput } from "@/lib/validations/attendance";
import { saveAttendanceDay } from "@/server/actions/attendance";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const STATUS_TONE: Record<string, string> = {
  rest_day: "bg-muted/60",
  absent: "bg-destructive/5",
  leave: "bg-blush/50",
  holiday: "bg-sage/15",
};

export type DayStaff = {
  id: string;
  name: string;
  position: string;
  /** Their daily rate today: new records start with it. */
  currentRate: number;
  log: {
    status: DayStatus;
    timeIn: string | null;
    timeOut: string | null;
    dailyRate: number;
    note: string | null;
  } | null;
};

const dayHref = (date: string) => `/admin/dtr/day?date=${date}`;
const shiftDate = (date: string, days: number) =>
  format(addDays(parseISO(date), days), "yyyy-MM-dd");

/**
 * Time record → By day: every active employee on one date, one row each.
 * Saves only the rows that changed.
 */
export function DayAttendanceSheet({
  date,
  today,
  staff,
  hoursPerDay,
  amPmRate,
}: {
  date: string;
  today: string;
  staff: DayStaff[];
  hoursPerDay: number;
  amPmRate: number;
}) {
  const router = useRouter();
  const shift = Math.round(hoursPerDay * 60);
  const amPmRateInput = amountToInput(amPmRate);
  const defaults: AttendanceTeamDayInput = {
    date,
    rows: staff.map((s) => ({
      employeeId: s.id,
      day: {
        date,
        status: s.log?.status ?? "",
        timeIn: s.log?.timeIn ?? "",
        timeOut: s.log?.timeOut ?? "",
        // Recorded days keep the rate they were saved with.
        rate: amountToInput(s.log ? s.log.dailyRate : s.currentRate),
        note: s.log?.note ?? "",
      },
    })),
  };
  const form = useForm<AttendanceTeamDayInput, unknown, z.output<typeof attendanceDaySchema>>({
    resolver: zodResolver(attendanceDaySchema),
    defaultValues: defaults,
  });
  const { control } = form;
  const { fields } = useFieldArray({ control, name: "rows" });
  const rows = useWatch({ control, name: "rows" });
  const dirty = form.formState.isDirty;
  useUnsavedChangesWarning(dirty);

  const [fillIn, setFillIn] = useState("09:00");
  const [fillOut, setFillOut] = useState("17:00");

  const set = (path: Parameters<typeof form.setValue>[0], value: string) =>
    form.setValue(path, value, { shouldDirty: true });

  const original = (i: number) => JSON.stringify(form.formState.defaultValues?.rows?.[i]?.day);
  const changedCount = (rows ?? []).filter((r, i) => JSON.stringify(r.day) !== original(i)).length;

  const minutesFor = (d: AttendanceTeamDayInput["rows"][number]["day"] | undefined) =>
    d && hasTimes(d.status) && TIME.test(d.timeIn) && TIME.test(d.timeOut) && d.timeIn !== d.timeOut
      ? minutesWorked(d.timeIn, d.timeOut)
      : 0;

  function pickStatus(i: number, next: string) {
    const before = form.getValues(`rows.${i}.day`);
    const after = afterStatusChange(before, next, {
      current: amountToInput(staff[i]!.currentRate),
      amPm: amPmRateInput,
    });
    set(`rows.${i}.day.status`, after.status);
    set(`rows.${i}.day.timeIn`, after.timeIn);
    set(`rows.${i}.day.timeOut`, after.timeOut);
    set(`rows.${i}.day.rate`, after.rate);
    form.clearErrors([`rows.${i}.day.timeIn`, `rows.${i}.day.timeOut`]);
  }

  function fillBlank(status: "present" | "rest_day") {
    if (status === "present" && (!TIME.test(fillIn) || !TIME.test(fillOut) || fillIn === fillOut)) {
      toast.error("Enter a time in and a different time out first.");
      return;
    }
    let filled = 0;
    form.getValues("rows").forEach((r, i) => {
      if (r.day.status !== "") return;
      pickStatus(i, status);
      if (status === "present") {
        set(`rows.${i}.day.timeIn`, fillIn);
        set(`rows.${i}.day.timeOut`, fillOut);
      }
      filled += 1;
    });
    toast(
      filled
        ? `Marked ${filled} ${filled === 1 ? "person" : "people"} ${status === "present" ? "present" : "on rest day"}. Save to keep it.`
        : "Everyone already has something recorded.",
    );
  }

  async function onSubmit() {
    const values = form.getValues();
    const changed = values.rows.filter((r, i) => JSON.stringify(r.day) !== original(i));
    const result = await saveAttendanceDay({ date, rows: changed });
    const label = format(parseISO(date), "EEE d MMM");
    if (handleResult(result, `Time record saved for ${label}.`)) form.reset(values);
  }

  function jumpTo(next: string) {
    if (!next || next === date) return;
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    router.push(dayHref(next));
  }

  const busy = form.formState.isSubmitting;
  const cutoffStart = cutoffFor(date).start;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, () =>
        toast.error("Some rows need a time in, time out or rate."),
      )}
      noValidate
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="icon-lg">
          <Link href={dayHref(shiftDate(date, -1))} aria-label="Previous day">
            <ArrowLeftIcon aria-hidden />
          </Link>
        </Button>
        <h2 className="min-w-44 text-center text-2xl font-semibold">
          {format(parseISO(date), "EEE d MMM yyyy")}
        </h2>
        <Button asChild variant="outline" size="icon-lg">
          <Link href={dayHref(shiftDate(date, 1))} aria-label="Next day">
            <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
        <Label htmlFor="day-jump" className="sr-only">
          Go to a date
        </Label>
        <Input
          id="day-jump"
          type="date"
          value={date}
          onChange={(e) => jumpTo(e.target.value)}
          className="w-auto"
        />
        {date !== today && (
          <Button asChild variant="ghost">
            <Link href={dayHref(today)}>Today</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border bg-card p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="grid gap-1.5">
            <Label htmlFor="day-fill-in">Usual time in</Label>
            <Input
              id="day-fill-in"
              type="time"
              value={fillIn}
              onChange={(e) => setFillIn(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="day-fill-out">Usual time out</Label>
            <Input
              id="day-fill-out"
              type="time"
              value={fillOut}
              onChange={(e) => setFillOut(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => fillBlank("present")}>
            <CalendarCheckIcon aria-hidden />
            Mark blank rows present
          </Button>
          <Button type="button" variant="outline" onClick={() => fillBlank("rest_day")}>
            <MoonIcon aria-hidden />
            Mark blank rows rest day
          </Button>
        </div>
        <p className="text-sm text-muted-foreground lg:basis-full">
          Fills only people with nothing recorded for this day. AM, PM and AM/PM fill in their own
          times; change anyone&apos;s row after.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border bg-card">
        <Table>
          <TableHeader className="max-xl:sr-only">
            <TableRow>
              <TableHead className="pl-5">Employee</TableHead>
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
              const person = staff[i]!;
              const d = rows?.[i]?.day;
              const timed = hasTimes(d?.status ?? "");
              const edited = d ? isTimeOutEdited(d.status, d.timeIn, d.timeOut) : false;
              const rate = parseAmount(d?.rate ?? "");
              const specialRate = timed && rate !== null && rate !== person.currentRate;
              const who = person.name;
              return (
                <TableRow
                  key={field.id}
                  className={cn(
                    // Phones: each person is a small card (2 columns) instead of a wide row.
                    "grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 xl:table-row xl:p-0",
                    STATUS_TONE[d?.status ?? ""],
                  )}
                >
                  <TableCell className="col-span-2 self-center p-0 xl:py-2 xl:pl-5">
                    <Link
                      href={`/admin/dtr?cutoff=${cutoffStart}&employee=${person.id}`}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {who}
                    </Link>
                    <span className="block text-sm text-muted-foreground">{person.position}</span>
                  </TableCell>
                  <TableCell className="col-span-2 p-0 sm:col-span-1 xl:py-2">
                    <Controller
                      control={control}
                      name={`rows.${i}.day.status`}
                      render={({ field: f }) => (
                        <NativeSelect
                          name={f.name}
                          ref={f.ref}
                          value={f.value}
                          onBlur={f.onBlur}
                          aria-label={`Status, ${who}`}
                          className="w-full xl:w-36"
                          onChange={(e) => pickStatus(i, e.target.value)}
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
                        name={`rows.${i}.day.${name}`}
                        render={({ field: f, fieldState }) => (
                          <div>
                            <span className="mb-1 block text-xs text-muted-foreground xl:sr-only">
                              {name === "timeIn" ? "Time in" : "Time out"}
                            </span>
                            <Input
                              {...f}
                              type="time"
                              disabled={!timed}
                              aria-label={`${name === "timeIn" ? "Time in" : "Time out"}, ${who}`}
                              aria-invalid={fieldState.invalid}
                              className="xl:w-32"
                              onChange={(e) => {
                                f.onChange(e);
                                if (name !== "timeIn") return;
                                // Shifts: a new time in moves the time out with it.
                                const out = timeOutForNewTimeIn(
                                  form.getValues(`rows.${i}.day.status`),
                                  e.target.value,
                                );
                                if (out) set(`rows.${i}.day.timeOut`, out);
                              }}
                            />
                            {name === "timeOut" && edited && (
                              <span className="mt-1 block text-xs text-terracotta-ink">
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
                      name={`rows.${i}.day.rate`}
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
                              aria-label={`Daily rate, ${who}`}
                              aria-invalid={fieldState.invalid}
                              className="pl-7 tabular-nums xl:w-28"
                            />
                          </div>
                          {specialRate && !fieldState.error && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Usual {formatAmount(person.currentRate)}
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
                      name={`rows.${i}.day.note`}
                      render={({ field: f }) => (
                        <Input
                          {...f}
                          maxLength={200}
                          placeholder="Note"
                          aria-label={`Note, ${who}`}
                          className="xl:min-w-40"
                        />
                      )}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2">
        {dirty && (
          <span className="rounded-full bg-card px-3 py-1 text-sm shadow-sm">
            {changedCount} {changedCount === 1 ? "change" : "changes"}
          </span>
        )}
        <Button type="submit" size="lg" className="shadow-lg" disabled={busy || !dirty}>
          {busy && <Loader2Icon className="animate-spin" aria-hidden />}
          Save day
        </Button>
      </div>
    </form>
  );
}
