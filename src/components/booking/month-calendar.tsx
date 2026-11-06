"use client";

import { addDays, format, getDaysInMonth } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import type { DayStatus } from "@/lib/booking/slots";
import { cn } from "@/lib/utils";
import { shiftMonth, tzDate } from "@/lib/utils/business-date";

export type CalendarDay = { date: string; status: DayStatus; count: number };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Month grid in the style of mockup A: a dot marks days with free times (sage),
 * a terracotta dot marks days with only one or two left, and closed or fully
 * booked days are greyed out. Arrow keys move between days.
 */
export function MonthCalendar({
  month,
  days,
  selectedDate,
  onSelectDate,
  onMonthChange,
  canPrev,
  canNext,
  loading,
}: {
  month: string;
  /** null while loading */
  days: CalendarDay[] | null;
  selectedDate?: string | null;
  onSelectDate: (date: string) => void;
  onMonthChange: (month: string) => void;
  canPrev: boolean;
  canNext: boolean;
  loading?: boolean;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const first = tzDate(`${month}-01`);
  const leading = (first.getDay() + 6) % 7; // Monday-first
  const byDate = new Map(days?.map((d) => [d.date, d]));
  const dates = Array.from({ length: getDaysInMonth(first) }, (_, i) =>
    format(addDays(first, i), "yyyy-MM-dd"),
  );

  function onKeyDown(e: React.KeyboardEvent) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    const current = (e.target as HTMLElement).dataset.date;
    if (!step || !current) return;
    e.preventDefault();
    // Skip over days that can't be picked.
    for (let i = 1; i <= 31; i++) {
      const target = format(addDays(tzDate(current), step * i), "yyyy-MM-dd");
      const el = grid.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`);
      if (!el) return;
      if (!el.disabled) return el.focus();
    }
  }

  return (
    <div className="rounded-3xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          disabled={!canPrev}
          onClick={() => onMonthChange(shiftMonth(month, -1))}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
        <h3 className="font-heading text-xl font-semibold" aria-live="polite">
          {format(first, "MMMM yyyy")}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next month"
          disabled={!canNext}
          onClick={() => onMonthChange(shiftMonth(month, 1))}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
      </div>

      <div
        ref={grid}
        role="group"
        aria-label={`Dates in ${format(first, "MMMM yyyy")}`}
        aria-busy={loading || days === null}
        onKeyDown={onKeyDown}
        className={cn(
          "mt-3 grid grid-cols-7 gap-1 transition-opacity",
          (loading || days === null) && "opacity-50",
        )}
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            aria-hidden
            className="py-1 text-center text-xs font-semibold text-muted-foreground uppercase"
          >
            {d.slice(0, 2)}
          </div>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <div key={`blank-${i}`} aria-hidden />
        ))}
        {dates.map((date) => {
          const day = byDate.get(date);
          const status = day?.status ?? "closed";
          const pickable = status === "open" || status === "few";
          const selected = selectedDate === date;
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              disabled={!pickable}
              aria-pressed={selected}
              aria-label={`${format(tzDate(date), "EEEE, d MMMM")}, ${describe(day)}`}
              onClick={() => onSelectDate(date)}
              className={cn(
                "relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-2xl text-sm font-semibold transition-colors",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                pickable && "border bg-background hover:border-primary",
                pickable &&
                  "after:mt-0.5 after:size-1.5 after:rounded-full after:bg-sage after:content-['']",
                status === "few" && "after:bg-terracotta",
                status === "full" && "text-muted-foreground/60 line-through",
                status === "closed" && "text-muted-foreground/45",
                selected &&
                  "border-primary bg-primary text-primary-foreground after:bg-primary-foreground hover:border-primary",
              )}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sage" aria-hidden /> Available
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-terracotta" aria-hidden /> Few times left
        </li>
        <li className="line-through">Fully booked</li>
      </ul>
    </div>
  );
}

function describe(day: CalendarDay | undefined): string {
  if (!day || day.status === "closed") return "not available";
  if (day.status === "full") return "fully booked";
  return `${day.count} ${day.count === 1 ? "time" : "times"} available`;
}
