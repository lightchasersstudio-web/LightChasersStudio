"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, parseISO } from "date-fns";
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  cutoffFor,
  cutoffLabel,
  DAY_STATUSES,
  formatMinutes,
  hasTimes,
  isDayStatus,
  isShift,
  minutesWorked,
  type DayStatus,
} from "@/lib/payroll/cutoff";
import { computeDailyPay } from "@/lib/payroll/daily-pay";
import { afterStatusChange, timeOutForNewTimeIn } from "@/lib/payroll/day-entry";
import { pastCutoffWarning } from "@/lib/payroll/flow";
import {
  amountToInput,
  formatAmount,
  formatAmountExact,
  parseAmount,
  toPesos,
} from "@/lib/payroll/money";
import { cn } from "@/lib/utils";
import { attendanceDaySchema, type AttendanceTeamDayInput } from "@/lib/validations/attendance";
import { saveAttendanceDay } from "@/server/actions/attendance";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** "Present" with no times yet starts at 9:00 AM for one normal day. */
const USUAL_START = "09:00";

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
  /** Pesos per overtime hour; null = overtime isn't paid. */
  overtimeRate: number | null;
  log: {
    status: DayStatus;
    timeIn: string | null;
    timeOut: string | null;
    dailyRate: number;
    note: string | null;
  } | null;
};

export const payrollDayHref = (date: string) => `/admin/payroll?date=${date}`;
const shiftDate = (date: string, days: number) =>
  format(addDays(parseISO(date), days), "yyyy-MM-dd");

/** "13:30" → "1:30 PM" */
function clock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "09:00" + 480 → "17:00" */
function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const t = (h * 60 + m + minutes) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * Payroll → one day for the whole team: pick each person's status (times fill
 * in from the shift), "Edit" for times, rate and a note. Saving the day also
 * updates the cut-off's payslips. Saves only the rows that changed.
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
  // Rows showing their times, rate and note.
  const [editing, setEditing] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setEditing((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const set = (path: Parameters<typeof form.setValue>[0], value: string) =>
    form.setValue(path, value, { shouldDirty: true });

  const original = (i: number) => JSON.stringify(form.formState.defaultValues?.rows?.[i]?.day);
  const changedCount = (rows ?? []).filter((r, i) => JSON.stringify(r.day) !== original(i)).length;
  const blankCount = (rows ?? []).filter((r) => r.day.status === "").length;

  /** A row's pay for the day (centavos), worked out like the payslips do. */
  function payFor(i: number): number {
    const d = rows?.[i]?.day;
    if (!d || !isDayStatus(d.status)) return 0;
    const timed = hasTimes(d.status);
    const minutes =
      timed && TIME.test(d.timeIn) && TIME.test(d.timeOut) && d.timeIn !== d.timeOut
        ? minutesWorked(d.timeIn, d.timeOut)
        : 0;
    return computeDailyPay({
      status: d.status,
      minutes,
      dailyRate: parseAmount(d.rate) ?? 0,
      shiftMinutes: shift,
      overtimeRate: staff[i]!.overtimeRate,
    }).payCents;
  }
  const pays = fields.map((_, i) => payFor(i));
  const dayTotal = pays.reduce((sum, p) => sum + p, 0);
  const paidCount = pays.filter((p) => p > 0).length;

  function pickStatus(i: number, next: string) {
    const before = form.getValues(`rows.${i}.day`);
    const after = afterStatusChange(before, next, {
      current: amountToInput(staff[i]!.currentRate),
      amPm: amPmRateInput,
    });
    // Present with no times yet: one normal day from 9:00 AM.
    if (next === "present" && !TIME.test(after.timeIn) && !TIME.test(after.timeOut)) {
      after.timeIn = USUAL_START;
      after.timeOut = addMinutes(USUAL_START, shift);
    }
    set(`rows.${i}.day.status`, after.status);
    set(`rows.${i}.day.timeIn`, after.timeIn);
    set(`rows.${i}.day.timeOut`, after.timeOut);
    set(`rows.${i}.day.rate`, after.rate);
    form.clearErrors([`rows.${i}.day.timeIn`, `rows.${i}.day.timeOut`]);
  }

  function fillBlank(status: "present" | "rest_day") {
    form.getValues("rows").forEach((r, i) => {
      if (r.day.status === "") pickStatus(i, status);
    });
  }

  async function onSubmit() {
    const values = form.getValues();
    const changed = values.rows.filter((r, i) => JSON.stringify(r.day) !== original(i));
    // A cut-off that's over is already paid: say whose payslip changes first.
    const cutoff = cutoffFor(date);
    if (cutoff.end < today) {
      const names = changed.map((r) => staff.find((s) => s.id === r.employeeId)?.name ?? "");
      if (!window.confirm(pastCutoffWarning(cutoffLabel(cutoff), names))) return;
    }
    const result = await saveAttendanceDay({ date, rows: changed });
    const label = format(parseISO(date), "EEE d MMM");
    if (handleResult(result, `${label} saved. Payslips are updated.`)) {
      form.reset(values);
      setEditing(new Set());
    }
  }

  function jumpTo(next: string) {
    if (!next || next === date) return;
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    router.push(payrollDayHref(next));
  }

  const busy = form.formState.isSubmitting;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, (errors) => {
        // Open the rows that need fixing.
        setEditing((prev) => new Set([...prev, ...Object.keys(errors.rows ?? {}).map(Number)]));
        toast.error("Some rows need a time in and time out.");
      })}
      noValidate
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="icon-lg">
          <Link href={payrollDayHref(shiftDate(date, -1))} aria-label="Previous day">
            <ArrowLeftIcon aria-hidden />
          </Link>
        </Button>
        <h2 className="min-w-44 text-center text-2xl font-semibold">
          {format(parseISO(date), "EEE d MMM yyyy")}
        </h2>
        <Button asChild variant="outline" size="icon-lg">
          <Link href={payrollDayHref(shiftDate(date, 1))} aria-label="Next day">
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
            <Link href={payrollDayHref(today)}>Today</Link>
          </Button>
        )}
      </div>

      {blankCount > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {blankCount === staff.length ? "Everyone" : `The other ${blankCount}`}:
          <Button type="button" variant="outline" size="sm" onClick={() => fillBlank("present")}>
            Present
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fillBlank("rest_day")}>
            Rest day
          </Button>
        </p>
      )}

      <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
        {fields.map((field, i) => {
          const person = staff[i]!;
          const d = rows?.[i]?.day;
          const status = d?.status ?? "";
          const timed = hasTimes(status);
          const open = editing.has(i);
          const minutes =
            d && timed && TIME.test(d.timeIn) && TIME.test(d.timeOut) && d.timeIn !== d.timeOut
              ? minutesWorked(d.timeIn, d.timeOut)
              : 0;
          const rate = parseAmount(d?.rate ?? "");
          const specialRate = timed && rate !== null && rate !== person.currentRate;
          const who = person.name;
          return (
            <li key={field.id} className={cn("px-4 py-3 sm:px-5", STATUS_TONE[status])}>
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(9rem,1fr)_11rem_minmax(0,1.4fr)_6.5rem_auto]">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{who}</p>
                  <p className="text-sm text-muted-foreground">{person.position}</p>
                </div>
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
                      className="w-36 sm:w-full"
                      onChange={(e) => pickStatus(i, e.target.value)}
                    >
                      <NativeSelectOption value="">Not set</NativeSelectOption>
                      {DAY_STATUSES.map((s) => (
                        <NativeSelectOption key={s.value} value={s.value}>
                          {s.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                />
                <p className="col-span-2 text-sm text-muted-foreground sm:col-span-1">
                  {timed && TIME.test(d?.timeIn ?? "") && TIME.test(d?.timeOut ?? "") ? (
                    <>
                      <span className="text-foreground">
                        {clock(d!.timeIn)} – {clock(d!.timeOut)}
                      </span>{" "}
                      · {formatMinutes(minutes)}
                      {status === "present" && minutes > shift && (
                        <> · {formatMinutes(minutes - shift)} overtime</>
                      )}
                      {status === "present" && minutes > 0 && minutes < shift && (
                        <> · {formatMinutes(shift - minutes)} short</>
                      )}
                      {isShift(status) && <> · full day</>}
                    </>
                  ) : null}
                  {specialRate && <> · rate {formatAmount(rate!)}</>}
                  {d?.note && !open && <span className="block truncate">“{d.note}”</span>}
                </p>
                <p
                  className={cn(
                    "text-right tabular-nums max-sm:col-start-2 max-sm:row-start-2",
                    pays[i]! > 0 ? "font-semibold" : "text-muted-foreground",
                  )}
                  aria-label={`Pay for the day, ${who}`}
                >
                  {status === "" ? "—" : formatAmountExact(toPesos(pays[i]!))}
                </p>
                {status !== "" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="col-start-2 row-start-1 justify-self-end sm:col-start-auto sm:row-start-auto"
                    aria-expanded={open}
                    aria-label={`${open ? "Hide" : "Edit"} times and note, ${who}`}
                    onClick={() => toggle(i)}
                  >
                    <PencilIcon aria-hidden />
                    {open ? "Done" : "Edit"}
                  </Button>
                )}
              </div>

              {open && status !== "" && (
                <div className="mt-3 grid gap-3 rounded-2xl bg-background/70 p-3 sm:grid-cols-4">
                  {timed &&
                    (["timeIn", "timeOut"] as const).map((name) => (
                      <Controller
                        key={name}
                        control={control}
                        name={`rows.${i}.day.${name}`}
                        render={({ field: f, fieldState }) => (
                          <div className="grid gap-1.5">
                            <Label htmlFor={`${name}-${i}`}>
                              {name === "timeIn" ? "Time in" : "Time out"}
                            </Label>
                            <Input
                              {...f}
                              id={`${name}-${i}`}
                              type="time"
                              aria-invalid={fieldState.invalid}
                              onChange={(e) => {
                                f.onChange(e);
                                if (name !== "timeIn") return;
                                // Shifts: a new time in moves the time out with it.
                                const out = timeOutForNewTimeIn(status, e.target.value);
                                if (out) set(`rows.${i}.day.timeOut`, out);
                              }}
                            />
                            {fieldState.error && (
                              <p role="alert" className="text-xs text-destructive">
                                {fieldState.error.message}
                              </p>
                            )}
                          </div>
                        )}
                      />
                    ))}
                  {timed && (
                    <Controller
                      control={control}
                      name={`rows.${i}.day.rate`}
                      render={({ field: f, fieldState }) => (
                        <div className="grid gap-1.5">
                          <Label htmlFor={`rate-${i}`}>Daily rate (₱)</Label>
                          <Input
                            {...f}
                            id={`rate-${i}`}
                            inputMode="decimal"
                            autoComplete="off"
                            aria-invalid={fieldState.invalid}
                            className="tabular-nums"
                          />
                          {fieldState.error ? (
                            <p role="alert" className="text-xs text-destructive">
                              {fieldState.error.message}
                            </p>
                          ) : (
                            specialRate && (
                              <span className="text-xs text-muted-foreground">
                                Usual {formatAmount(person.currentRate)}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    />
                  )}
                  <Controller
                    control={control}
                    name={`rows.${i}.day.note`}
                    render={({ field: f }) => (
                      <div className={cn("grid gap-1.5", !timed && "sm:col-span-4")}>
                        <Label htmlFor={`note-${i}`}>Note</Label>
                        <Input {...f} id={`note-${i}`} maxLength={200} placeholder="Optional" />
                      </div>
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
        <li className="flex flex-wrap items-baseline justify-between gap-x-4 bg-muted/60 px-4 py-3 sm:px-5">
          <span>
            <span className="font-semibold">Pay for this day</span>
            <span className="text-sm text-muted-foreground">
              {" "}
              · {paidCount} {paidCount === 1 ? "person" : "people"} · before SSS, PhilHealth and
              Pag-IBIG
            </span>
          </span>
          <span className="font-heading text-lg font-semibold tabular-nums">
            {formatAmountExact(toPesos(dayTotal))}
          </span>
        </li>
      </ul>

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
