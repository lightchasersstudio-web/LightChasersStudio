import { addDays, format, parseISO } from "date-fns";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CheckInCard } from "@/components/admin/bookings/check-in-card";
import { EmptyList } from "@/components/admin/lists/pager";
import { PageHeader } from "@/components/admin/page-header";
import { ListSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { businessToday } from "@/lib/utils/business-date";
import { dateString } from "@/lib/validations/shared";
import { requireAdmin } from "@/server/auth";
import { listDayCheckIns } from "@/server/queries/check-in";

export const metadata: Metadata = { title: "Today" };

const href = (date: string) => `/admin/today?date=${date}`;
const shift = (date: string, days: number) => format(addDays(parseISO(date), days), "yyyy-MM-dd");

/** Shoot-day check-in for every booking on a day (owner request 2026-11-14). */
export default function TodayPage({ searchParams }: PageProps<"/admin/today">) {
  return (
    <>
      <PageHeader
        eyebrow="shoot day"
        title="Today"
        description="Every shoot of the day with what to do when the client arrives and leaves: ID, inspections, balance and security deposit."
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Today searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Today({ searchParams }: Pick<PageProps<"/admin/today">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const today = businessToday();
  const parsed = dateString.safeParse(params.date);
  const date = parsed.success ? parsed.data : today;
  const bookings = await listDayCheckIns(date);
  const label =
    date === today
      ? "Today"
      : date === shift(today, 1)
        ? "Tomorrow"
        : date === shift(today, -1)
          ? "Yesterday"
          : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="icon-lg">
          <Link href={href(shift(date, -1))} aria-label="Previous day">
            <ArrowLeftIcon aria-hidden />
          </Link>
        </Button>
        <h2 className="min-w-44 text-center text-2xl font-semibold">
          {label && (
            <span className="block text-sm font-normal text-muted-foreground">{label}</span>
          )}
          {format(parseISO(date), "EEE d MMM yyyy")}
        </h2>
        <Button asChild variant="outline" size="icon-lg">
          <Link href={href(shift(date, 1))} aria-label="Next day">
            <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
        {date !== today && (
          <Button asChild variant="ghost">
            <Link href={href(today)}>Today</Link>
          </Button>
        )}
      </div>

      {bookings.length === 0 ? (
        <EmptyList
          title="No shoots this day"
          text="Bookings that are confirmed (or waiting for your OK) show here on their day."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {bookings.map((b) => (
            <CheckInCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}
