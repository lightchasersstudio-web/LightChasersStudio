import { TZDate } from "@date-fns/tz";
import { addMinutes, format } from "date-fns";
import { AlertTriangleIcon, BanIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { STATUS_TONES } from "@/components/booking/status-badge";
import { Button } from "@/components/ui/button";
import { occupancyAt } from "@/lib/booking/slots";
import { STATUS_LABELS } from "@/lib/booking/status";
import { layoutDay } from "@/lib/booking/timeline-layout";
import { cn } from "@/lib/utils";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import type { CalendarBooking, CalendarContext } from "@/server/queries/bookings";

const HOUR_PX = 56;
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

/**
 * One day, hour by hour (mockup A's side panel): bookings as blocks (overlapping
 * ones side by side) and, in the right-hand lane, free gaps that open
 * "New booking" with the time filled in.
 */
export function DayTimeline({
  date,
  bookings,
  context,
  now,
}: {
  date: string;
  bookings: CalendarBooking[];
  context: CalendarContext;
  now: Date;
}) {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const midnight = new TZDate(y, mo - 1, d, BUSINESS_TZ);
  const at = (min: number) => new TZDate(y, mo - 1, d, Math.floor(min / 60), min % 60, BUSINESS_TZ);
  const minuteOf = (iso: string) => {
    const t = new TZDate(iso, BUSINESS_TZ);
    return format(t, "yyyy-MM-dd") === date ? t.getHours() * 60 + t.getMinutes() : null;
  };

  const blockedReason = context.blackouts.find((b) => b.date === date);
  const windows = blockedReason ? [] : context.hours.filter((h) => h.day === midnight.getDay());

  // Visible range: opening hours plus any bookings outside them, whole hours.
  const bookingMins = bookings.flatMap((b) => [
    minuteOf(b.startAt) ?? 0,
    minuteOf(b.endAt) ?? 24 * 60,
  ]);
  const starts = [...windows.map((w) => toMin(w.start)), ...bookingMins];
  const ends = [...windows.map((w) => toMin(w.end)), ...bookingMins];
  const from = Math.floor((starts.length ? Math.min(...starts) : 8 * 60) / 60) * 60;
  const to = Math.min(24 * 60, Math.ceil((ends.length ? Math.max(...ends) : 20 * 60) / 60) * 60);
  const top = (min: number) => ((min - from) / 60) * HOUR_PX;

  // Free gaps: open slots (inside hours, in the future) with room for another shoot.
  const busy = bookings.map((b) => ({ start: new Date(b.startAt), end: new Date(b.blockedUntil) }));
  const step = context.slotInterval;
  const gaps: { start: number; end: number }[] = [];
  for (const w of windows) {
    for (let m = toMin(w.start); m + step <= toMin(w.end); m += step) {
      const s = at(m);
      const free = s > now && occupancyAt(busy, s, addMinutes(s, step)) < context.capacity;
      const last = gaps.at(-1);
      if (!free) continue;
      if (last && last.end === m) last.end = m + step;
      else gaps.push({ start: m, end: m + step });
    }
  }

  const placements = new Map(
    layoutDay(
      bookings.map((b) => ({ id: b.id, start: new Date(b.startAt), end: new Date(b.endAt) })),
    ).map((p) => [p.id, p]),
  );
  const hhmm = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  return (
    <section aria-labelledby="day-heading" className="rounded-3xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="day-heading" className="font-heading text-xl font-semibold">
            {format(midnight, "EEEE, d MMMM")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {bookings.length} booking{bookings.length === 1 ? "" : "s"}
            {context.capacity > 1 && ` · up to ${context.capacity} at once`}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/admin/bookings/new?date=${date}`}>
            <PlusIcon aria-hidden />
            Book
          </Link>
        </Button>
      </div>

      {(blockedReason || windows.length === 0) && (
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-muted p-3 text-sm">
          <BanIcon className="size-4 shrink-0" aria-hidden />
          {blockedReason
            ? `Blocked${blockedReason.reason ? `: ${blockedReason.reason}` : ""}. You can still book with a warning.`
            : "Closed (no opening hours). You can still book with a warning."}
        </p>
      )}

      <div className="relative mt-4 flex" style={{ height: ((to - from) / 60) * HOUR_PX }}>
        {/* Hour lines and labels */}
        <ol aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: (to - from) / 60 }, (_, i) => (
            <li
              key={i}
              className="absolute inset-x-0 border-t border-border/70 pl-0 text-[11px] text-muted-foreground"
              style={{ top: i * HOUR_PX }}
            >
              {format(at(from + i * 60), "h a")}
            </li>
          ))}
        </ol>

        {/* Bookings */}
        <ul className="relative ml-11 flex-1" aria-label="Bookings">
          {bookings.map((b) => {
            const p = placements.get(b.id)!;
            const s = minuteOf(b.startAt) ?? from;
            const e = minuteOf(b.endAt) ?? to;
            return (
              <li
                key={b.id}
                className="absolute px-0.5"
                style={{
                  top: top(s),
                  height: Math.max(top(e) - top(s), 24),
                  left: `${(p.column / p.columns) * 100}%`,
                  width: `${100 / p.columns}%`,
                }}
              >
                <Link
                  href={`/admin/bookings/${b.id}`}
                  className={cn(
                    "flex h-full flex-col overflow-hidden rounded-lg border border-l-4 px-2 py-1 text-xs leading-tight transition-shadow hover:shadow-md",
                    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    STATUS_TONES[b.status],
                  )}
                >
                  <span className="flex items-center gap-1 font-bold">
                    {b.needsRefundReview && (
                      <AlertTriangleIcon
                        className="size-3 text-destructive"
                        aria-label="Needs review"
                      />
                    )}
                    {format(new TZDate(b.startAt, BUSINESS_TZ), "h:mm a")} · {b.contactName}
                  </span>
                  <span className="truncate">{b.serviceName}</span>
                  <span className="truncate opacity-80">{STATUS_LABELS[b.status]}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Free lane */}
        <ul className="relative w-16 shrink-0 sm:w-24" aria-label="Free times">
          {gaps.map((g) => (
            <li
              key={g.start}
              className="absolute inset-x-0 px-0.5"
              style={{ top: top(g.start), height: top(g.end) - top(g.start) }}
            >
              <Link
                href={`/admin/bookings/new?date=${date}&time=${hhmm(g.start)}`}
                aria-label={`Book from ${format(at(g.start), "h:mm a")} (free until ${format(at(g.end), "h:mm a")})`}
                className="flex h-full items-start justify-center rounded-lg border-2 border-dashed border-sage bg-sage/10 pt-1 text-[11px] font-bold text-foreground transition-colors hover:bg-sage/25 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                + free
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
