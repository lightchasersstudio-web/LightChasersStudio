import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  CameraIcon,
  ExternalLinkIcon,
  FlaskConicalIcon,
  ImagePlusIcon,
  InboxIcon,
  PartyPopperIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CountUp } from "@/components/admin/count-up";
import { StatusBadge } from "@/components/booking/status-badge";
import { RevealItem, RevealList } from "@/components/shared/reveal";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentsMockEnabled } from "@/lib/payments/mock";
import { cn } from "@/lib/utils";
import { BUSINESS_TZ, businessToday, manilaDate, manilaTime } from "@/lib/utils/business-date";
import { requireAdmin } from "@/server/auth";
import { getDashboard, type DashboardBooking } from "@/server/queries/bookings";

export const metadata: Metadata = { title: "Dashboard" };

const QUICK_ACTIONS: { href: string; label: string; icon: LucideIcon; external?: boolean }[] = [
  { href: "/admin/bookings/new", label: "New booking", icon: CalendarPlusIcon },
  { href: "/admin/calendar", label: "Open calendar", icon: CalendarDaysIcon },
  { href: "/admin/portfolio", label: "Add photos", icon: ImagePlusIcon },
  { href: "/admin/services", label: "Edit packages", icon: CameraIcon },
  { href: "/", label: "View website", icon: ExternalLinkIcon, external: true },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      {paymentsMockEnabled() && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-terracotta bg-blush px-4 py-3 text-sm text-terracotta-ink">
          <FlaskConicalIcon className="size-4 shrink-0" aria-hidden />
          <strong>Trial mode:</strong> payments are pretend and emails aren&apos;t sent.
          <Link href="/admin/trial-emails" className="font-semibold underline underline-offset-4">
            See the emails
          </Link>
        </p>
      )}
      <section className="relative overflow-hidden rounded-3xl border bg-accent/60 p-6 md:p-10">
        <div className="pointer-events-none absolute -top-20 -right-20 size-64 animate-float rounded-full bg-terracotta/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-64 animate-float rounded-full bg-sage/25 blur-3xl [animation-delay:-4s]" />
        <Sparkle className="absolute top-6 right-8 size-6 animate-twinkle text-terracotta" />
        <Sparkle className="absolute top-14 right-16 size-3 animate-twinkle text-sage [animation-delay:1.2s]" />
        <div className="relative">
          <p className="font-script text-2xl text-terracotta-ink">hello again,</p>
          <Suspense fallback={<Skeleton className="mt-2 h-10 w-64" />}>
            <AdminName />
          </Suspense>
          <p className="mt-3 max-w-prose text-muted-foreground">
            Here&apos;s what&apos;s happening at the studio.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map(({ href, label, icon: Icon, external }, i) => (
              <li key={href}>
                <Button
                  asChild
                  variant={i === 0 ? "default" : "outline"}
                  className={cn(i > 0 && "bg-background/70 backdrop-blur")}
                >
                  <Link
                    href={href}
                    {...(external && { target: "_blank", rel: "noopener noreferrer" })}
                  >
                    <Icon aria-hidden />
                    {label}
                    {external && <span className="sr-only"> (opens in a new tab)</span>}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardBody />
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

async function DashboardBody() {
  await requireAdmin();
  const d = await getDashboard();
  const todayDate = businessToday();
  const todayHref = `/admin/calendar?month=${todayDate.slice(0, 7)}&day=${todayDate}`;

  const stats: StatProps[] = [
    { label: "Shoots today", value: d.todayCount, icon: SunIcon, href: todayHref },
    { label: "Next 7 days", value: d.weekCount, icon: CalendarDaysIcon, href: "/admin/calendar" },
    {
      label: "Need your review",
      value: d.needsReviewCount,
      icon: InboxIcon,
      href: "#attention",
      alert: d.needsReviewCount > 0,
    },
    {
      label: "Late payments to check",
      value: d.refundReviewCount,
      icon: AlertTriangleIcon,
      href: "#attention",
      alert: d.refundReviewCount > 0,
    },
  ];

  return (
    <>
      <RevealList className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <RevealItem key={s.label}>
            <Stat {...s} />
          </RevealItem>
        ))}
      </RevealList>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Up next"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/calendar">
                Calendar
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          }
        >
          {d.upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDaysIcon}
              title="Nothing booked in the next two weeks"
              text="New bookings will show up here as soon as they come in."
            />
          ) : (
            <BookingList bookings={d.upcoming} showDay />
          )}
        </Panel>

        <div id="attention" className="scroll-mt-24">
          <Panel title="Needs your attention">
            {d.attention.length === 0 ? (
              <EmptyState
                icon={PartyPopperIcon}
                title="All caught up!"
                text="No requests waiting for a yes or no."
              />
            ) : (
              <BookingList bookings={d.attention} showDay />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

type StatProps = {
  label: string;
  value: number;
  icon: LucideIcon;
  href: string;
  alert?: boolean;
};

function Stat({ label, value, icon: Icon, href, alert }: StatProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col gap-3 rounded-3xl border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-5",
        alert && "border-terracotta/60 bg-blush/60",
      )}
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-full bg-secondary text-secondary-foreground transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6",
          alert && "bg-terracotta text-white",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="font-heading text-4xl leading-none font-semibold">
        <CountUp value={value} />
      </span>
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
    </Link>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="h-full rounded-3xl border bg-card p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function BookingList({ bookings, showDay }: { bookings: DashboardBooking[]; showDay?: boolean }) {
  return (
    <RevealList className="-mx-2 divide-y" stagger={0.05}>
      {bookings.map((b) => (
        <RevealItem key={b.id}>
          <Link
            href={`/admin/bookings/${b.id}`}
            className="group flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex w-16 shrink-0 flex-col items-center rounded-2xl bg-secondary px-1 py-1.5 text-center text-secondary-foreground">
              {showDay && (
                <span className="text-[0.7rem] font-bold tracking-wide uppercase">
                  {dayLabel(b.startAt)}
                </span>
              )}
              <span className="text-xs font-semibold">{manilaTime(b.startAt)}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{b.contactName}</span>
              <span className="block truncate text-sm text-muted-foreground">{b.serviceName}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge status={b.status} />
              {b.needsRefundReview && (
                <span className="text-xs font-semibold text-terracotta-ink">Check payment</span>
              )}
            </span>
            <ArrowRightIcon
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </RevealItem>
      ))}
    </RevealList>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed px-4 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/** "Today", "Tmrw" or "Fri 23" in studio time. */
function dayLabel(iso: string): string {
  const date = manilaDate(iso);
  if (date === businessToday()) return "Today";
  if (date === format(addDays(TZDate.tz(BUSINESS_TZ), 1), "yyyy-MM-dd")) return "Tmrw";
  return format(new TZDate(iso, BUSINESS_TZ), "EEE d");
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-3xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  );
}
