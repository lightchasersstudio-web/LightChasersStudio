"use client";

import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { useEffect, useState } from "react";

import { MonthCalendar } from "@/components/booking/month-calendar";
import { TimeSlots } from "@/components/booking/time-slots";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActionResult } from "@/lib/utils/action-result";
import { BUSINESS_TZ, tzDate } from "@/lib/utils/business-date";
import type { MonthSlotsPayload } from "@/server/queries/availability-slots";

/**
 * Month calendar + time list (mockup A). `load` fetches one month's free times;
 * results are kept per month so flipping back is instant. `value` is the chosen
 * start time as an ISO string. Change `reloadKey` to force a refetch (e.g. after
 * "that time was just taken").
 */
export function SlotPicker({
  load,
  minMonth,
  maxMonth,
  value,
  onChange,
  reloadKey = 0,
  initialDate,
}: {
  load: (month: string) => Promise<ActionResult<MonthSlotsPayload>>;
  minMonth: string;
  maxMonth: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  reloadKey?: number;
  /** "YYYY-MM-DD" to open on when no time is chosen yet. */
  initialDate?: string;
}) {
  // A pre-chosen time (e.g. from the admin calendar) opens on its Manila date.
  const openOn = value
    ? format(new TZDate(value, BUSINESS_TZ), "yyyy-MM-dd")
    : (initialDate ?? null);
  const [month, setMonth] = useState(() => openOn?.slice(0, 7) ?? minMonth);
  const [cache, setCache] = useState<Record<string, MonthSlotsPayload>>({});
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [date, setDate] = useState<string | null>(openOn);
  const [lastReload, setLastReload] = useState(reloadKey);

  // A new reloadKey drops everything cached (render-time reset, no effect needed).
  if (lastReload !== reloadKey) {
    setLastReload(reloadKey);
    setCache({});
  }

  const days = cache[month] ?? null;
  useEffect(() => {
    if (days) return;
    let cancelled = false;
    load(month).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setError(null);
        setCache((c) => ({ ...c, [month]: result.data }));
      } else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [month, days, load, attempt]);

  const selectedDay = days?.find((d) => d.date === date);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
      <MonthCalendar
        month={month}
        days={days?.map((d) => ({ date: d.date, status: d.status, count: d.slots.length })) ?? null}
        selectedDate={date}
        onSelectDate={(d) => {
          setDate(d);
          onChange(null);
        }}
        onMonthChange={(m) => {
          setMonth(m);
          setDate(null);
          onChange(null);
        }}
        canPrev={month > minMonth}
        canNext={month < maxMonth}
        loading={!days && !error}
      />
      <div className="rounded-3xl border bg-card p-4 sm:p-5">
        {error ? (
          <div role="alert" className="space-y-3">
            <p className="text-destructive">{error}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError(null);
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : !days ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-11 w-full rounded-full" />
            <Skeleton className="h-11 w-full rounded-full" />
          </div>
        ) : selectedDay ? (
          <>
            <h3 className="font-heading text-xl font-semibold">
              {format(tzDate(selectedDay.date), "EEEE, d MMMM")}
            </h3>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">Pick a start time</p>
            <TimeSlots slots={selectedDay.slots} value={value} onChange={onChange} />
          </>
        ) : (
          <p className="text-muted-foreground">
            {days.some((d) => d.status === "open" || d.status === "few")
              ? "Pick a day with a dot to see its free times."
              : "No free times this month. Try the next month."}
          </p>
        )}
      </div>
    </div>
  );
}
