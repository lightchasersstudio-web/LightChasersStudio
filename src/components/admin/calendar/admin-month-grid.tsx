import { TZDate } from "@date-fns/tz";
import { addDays, format, getDaysInMonth } from "date-fns";
import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";

import { STATUS_TONES } from "@/components/booking/status-badge";
import { cn } from "@/lib/utils";
import { BUSINESS_TZ, manilaDate } from "@/lib/utils/business-date";
import type { CalendarBooking, CalendarContext } from "@/server/queries/bookings";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;

/**
 * Month overview (mockup A): booking chips per day, closed and blocked days
 * hatched, today marked. Phones show a count per day instead of chips.
 */
export function AdminMonthGrid({
  month,
  today,
  selectedDay,
  bookings,
  context,
  dayHref,
}: {
  month: string;
  today: string;
  selectedDay: string;
  bookings: CalendarBooking[];
  context: CalendarContext;
  dayHref: (date: string) => string;
}) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new TZDate(y, m - 1, 1, BUSINESS_TZ);
  const leading = (first.getDay() + 6) % 7;
  const byDay = Map.groupBy(bookings, (b) => manilaDate(b.startAt));
  const blocked = new Map(context.blackouts.map((b) => [b.date, b.reason]));
  const openDays = new Set(context.hours.map((h) => h.day));

  return (
    <div className="overflow-hidden rounded-3xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/40" aria-hidden>
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase">
            <span className="sm:hidden">{d.slice(0, 1)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7">
        {Array.from({ length: leading }, (_, i) => (
          <li key={`blank-${i}`} aria-hidden className="border-r border-b bg-muted/20" />
        ))}
        {Array.from({ length: getDaysInMonth(first) }, (_, i) => {
          const day = addDays(first, i);
          const date = format(day, "yyyy-MM-dd");
          const items = byDay.get(date) ?? [];
          const closed = blocked.has(date) || !openDays.has(day.getDay());
          const selected = date === selectedDay;
          return (
            <li
              key={date}
              className={cn(
                "relative min-h-16 border-r border-b p-1 sm:min-h-24 sm:p-1.5",
                closed &&
                  "bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_4px,transparent_4px,transparent_8px)]",
                selected && "ring-2 ring-primary ring-inset",
              )}
            >
              <Link
                href={dayHref(date)}
                aria-current={selected ? "date" : undefined}
                aria-label={`${format(day, "EEEE d MMMM")}: ${items.length} booking${items.length === 1 ? "" : "s"}${blocked.has(date) ? ", blocked" : closed ? ", closed" : ""}`}
                className="absolute inset-0 rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              />
              <span
                className={cn(
                  "relative inline-grid size-6 place-items-center rounded-full text-xs font-bold",
                  date === today && "bg-terracotta text-white",
                )}
              >
                {i + 1}
              </span>
              {items.length > 0 && (
                <span className="relative mt-1 block text-center text-xs font-bold text-primary sm:hidden">
                  {items.length}
                </span>
              )}
              <ul className="relative mt-1 hidden space-y-0.5 sm:block">
                {items.slice(0, MAX_CHIPS).map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className={cn(
                        "flex items-center gap-1 truncate rounded-md border-l-3 px-1 py-0.5 text-[11px] leading-tight font-semibold",
                        STATUS_TONES[b.status],
                      )}
                    >
                      {b.needsRefundReview && (
                        <AlertTriangleIcon
                          className="size-3 shrink-0 text-destructive"
                          aria-label="Needs review"
                        />
                      )}
                      <span className="truncate">
                        {shortTime(b.startAt)} {b.contactName}
                      </span>
                    </Link>
                  </li>
                ))}
                {items.length > MAX_CHIPS && (
                  <li className="px-1 text-[11px] font-semibold text-muted-foreground">
                    +{items.length - MAX_CHIPS} more
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** "10a" / "2:30p": compact so the client's name fits in a chip. */
function shortTime(iso: string): string {
  const t = new TZDate(iso, BUSINESS_TZ);
  return format(t, t.getMinutes() ? "h:mmaaaaa" : "haaaaa");
}
