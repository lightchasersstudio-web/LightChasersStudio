import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarCheckIcon,
  FlaskConicalIcon,
  HourglassIcon,
  InboxIcon,
  WalletIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { StatusBadge } from "@/components/booking/status-badge";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentsMockEnabled } from "@/lib/payments/mock";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatPeso } from "@/lib/utils/money";
import { requireAdmin } from "@/server/auth";
import { getDashboard, type DashboardBooking } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border bg-accent/60 p-6 md:p-10">
        <Sparkle className="absolute top-6 right-8 size-6 text-terracotta" />
        <Sparkle className="absolute top-14 right-16 size-3 text-sage" />
        <p className="font-script text-2xl text-terracotta-ink">hello again,</p>
        <Suspense fallback={<Skeleton className="mt-2 h-10 w-64" />}>
          <AdminName />
        </Suspense>
        <p className="mt-3 max-w-prose text-muted-foreground">
          What needs your attention today, and how the month is going.
        </p>
      </section>
      <Suspense fallback={<DashboardSkeleton />}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function AdminName() {
  const admin = await requireAdmin();
  return (
    <h1 className="mt-1 text-3xl font-semibold md:text-4xl">{admin.fullName ?? "Welcome back"}</h1>
  );
}

async function Overview() {
  await requireAdmin();
  const d = await getDashboard();
  const tiles = [
    { label: "Needs your OK", value: String(d.needsReview.length), icon: InboxIcon },
    { label: "Sessions today", value: String(d.today.length), icon: CalendarCheckIcon },
    { label: "Bookings this month", value: String(d.stats.bookingsThisMonth), icon: Sparkle },
    {
      label: "Collected this month",
      value: formatPeso(d.stats.collectedThisMonthCents),
      icon: WalletIcon,
    },
  ];

  return (
    <>
      {paymentsMockEnabled() && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-terracotta bg-blush px-4 py-3 text-sm text-terracotta-ink">
          <FlaskConicalIcon className="size-4 shrink-0" aria-hidden />
          <strong>Trial mode:</strong> payments are pretend and emails aren&apos;t sent.
          <Link href="/admin/trial-emails" className="font-semibold underline underline-offset-4">
            See the emails
          </Link>
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-3xl border bg-card p-5">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4 text-terracotta" aria-hidden />
              {label}
            </dt>
            <dd className="mt-2 font-heading text-3xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <BookingList
          title="Needs your OK"
          icon={InboxIcon}
          empty="Nothing to review. New paid bookings show up here."
          bookings={d.needsReview}
          showDate
        />
        <BookingList
          title="Today"
          icon={CalendarCheckIcon}
          empty="No sessions today."
          bookings={d.today}
        />
        <BookingList
          title="Next 7 days"
          icon={CalendarCheckIcon}
          empty="No confirmed sessions in the next week."
          bookings={d.upcoming}
          showDate
        />
        <BookingList
          title="Waiting for payment"
          icon={HourglassIcon}
          empty="No one is in the middle of paying."
          bookings={d.awaitingPayment}
          showDate
          note={(b) =>
            b.holdExpiresAt
              ? `Held until ${format(new TZDate(b.holdExpiresAt, BUSINESS_TZ), "h:mm a")}`
              : null
          }
        />
      </div>

      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href="/admin/calendar">
            Open the calendar
            <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
      </div>
    </>
  );
}

function BookingList({
  title,
  icon: Icon,
  empty,
  bookings,
  showDate,
  note,
}: {
  title: string;
  icon: typeof InboxIcon;
  empty: string;
  bookings: DashboardBooking[];
  showDate?: boolean;
  note?: (b: DashboardBooking) => string | null;
}) {
  return (
    <section className="rounded-3xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Icon className="size-5 text-terracotta" aria-hidden />
        {title}
        {bookings.length > 0 && (
          <span className="rounded-full bg-accent px-2 text-sm font-bold text-accent-foreground">
            {bookings.length}
          </span>
        )}
      </h2>
      {bookings.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y">
          {bookings.slice(0, 8).map((b) => {
            const when = new TZDate(b.startAt, BUSINESS_TZ);
            const extra = note?.(b);
            return (
              <li key={b.id}>
                <Link
                  href={`/admin/bookings/${b.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="w-20 shrink-0 text-sm font-semibold">
                    {showDate && <span className="block">{format(when, "EEE d MMM")}</span>}
                    <span className={showDate ? "text-muted-foreground" : undefined}>
                      {format(when, "h:mm a")}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate font-semibold">
                      {b.needsRefundReview && (
                        <AlertTriangleIcon
                          className="size-4 shrink-0 text-destructive"
                          aria-label="Payment needs a refund check"
                        />
                      )}
                      {b.contactName}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {b.serviceName}
                      {extra && ` · ${extra}`}
                    </span>
                  </span>
                  <StatusBadge status={b.status} className="hidden shrink-0 sm:inline-flex" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {bookings.length > 8 && (
        <p className="mt-2 text-sm text-muted-foreground">
          +{bookings.length - 8} more in the calendar
        </p>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-48 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
