import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AdminMonthGrid } from "@/components/admin/calendar/admin-month-grid";
import { DayTimeline } from "@/components/admin/calendar/day-timeline";
import { LinkPending } from "@/components/admin/calendar/link-pending";
import { PageHeader } from "@/components/admin/page-header";
import { CalendarSkeleton } from "@/components/admin/skeletons";
import { STATUS_TONES } from "@/components/booking/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BUSINESS_TZ, businessToday, manilaDate, shiftMonth } from "@/lib/utils/business-date";
import { requireAdmin } from "@/server/auth";
import { getCalendarContext, listBookingsForMonth } from "@/server/queries/bookings";

export const metadata: Metadata = { title: "Calendar" };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  return (
    <>
      <PageHeader
        eyebrow="who's shooting when"
        title="Calendar"
        description="Every booking at a glance. Pick a day to see its timeline and free times."
        actions={
          <Button asChild>
            <Link href="/admin/bookings/new">
              <PlusIcon aria-hidden />
              New booking
            </Link>
          </Button>
        }
      />
      {/* The admin check, ?month/?day and the bookings load inside Suspense so
          clicking "Calendar" shows the page at once. */}
      <Suspense fallback={<CalendarSkeleton />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Calendar({ searchParams }: Pick<PageProps<"/admin/calendar">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const now = new Date();
  const today = businessToday(now);
  const month = MONTH.test(one(params.month) ?? "") ? one(params.month)! : today.slice(0, 7);
  const dayParam = one(params.day) ?? "";
  const day =
    DAY.test(dayParam) && dayParam.startsWith(month)
      ? dayParam
      : today.startsWith(month)
        ? today
        : `${month}-01`;
  const showClosed = one(params.cancelled) === "1";

  const [bookings, context] = await Promise.all([
    listBookingsForMonth(month, { includeClosed: showClosed }),
    getCalendarContext(month),
  ]);

  const href = (q: { month?: string; day?: string; cancelled?: boolean }) => {
    const sp = new URLSearchParams({ month: q.month ?? month });
    if (q.day) sp.set("day", q.day);
    if (q.cancelled ?? showClosed) sp.set("cancelled", "1");
    return `/admin/calendar?${sp}`;
  };
  const [y, m] = month.split("-").map(Number) as [number, number];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon">
            <Link href={href({ month: shiftMonth(month, -1) })} aria-label="Previous month">
              <LinkPending>
                <ChevronLeftIcon aria-hidden />
              </LinkPending>
            </Link>
          </Button>
          <h2 className="min-w-40 text-center font-heading text-2xl font-semibold">
            {format(new TZDate(y, m - 1, 1, BUSINESS_TZ), "MMMM yyyy")}
          </h2>
          <Button asChild variant="ghost" size="icon">
            <Link href={href({ month: shiftMonth(month, 1) })} aria-label="Next month">
              <LinkPending>
                <ChevronRightIcon aria-hidden />
              </LinkPending>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="ml-2">
            <Link href={href({ month: today.slice(0, 7), day: today })}>Today</Link>
          </Button>
        </div>
        <Link
          href={href({ day, cancelled: !showClosed })}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
        >
          <span
            className={cn(
              "relative h-5 w-9 rounded-full bg-muted transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-background after:shadow after:transition-transform",
              showClosed && "bg-primary after:translate-x-4",
            )}
            aria-hidden
          />
          {showClosed ? "Hide cancelled" : "Show cancelled"}
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <AdminMonthGrid
          month={month}
          today={today}
          selectedDay={day}
          bookings={bookings}
          context={context}
          dayHref={(d) => href({ day: d })}
        />
        <DayTimeline
          date={day}
          bookings={bookings.filter((b) => manilaDate(b.startAt) === day)}
          context={context}
          now={now}
        />
      </div>

      <ul className="mt-4 flex flex-wrap gap-2 text-xs">
        {(
          [
            ["confirmed", "Confirmed"],
            ["pending", "Deposit paid · needs your OK"],
            ["pending_payment", "Waiting for payment"],
          ] as const
        ).map(([status, label]) => (
          <li
            key={status}
            className={cn(
              "rounded-md border border-l-4 px-2 py-0.5 font-semibold",
              STATUS_TONES[status],
            )}
          >
            {label}
          </li>
        ))}
      </ul>
    </>
  );
}
