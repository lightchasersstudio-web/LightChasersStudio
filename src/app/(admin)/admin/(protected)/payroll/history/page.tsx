import { format, parseISO } from "date-fns";
import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyList } from "@/components/admin/lists/pager";
import { PageHeader } from "@/components/admin/page-header";
import { ListSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { dayStatusLabel, isDayStatus } from "@/lib/payroll/cutoff";
import type { MonthTotal, YearTotal } from "@/lib/payroll/history";
import { formatAmountExact, toPesos } from "@/lib/payroll/money";
import { cn } from "@/lib/utils";
import { businessToday } from "@/lib/utils/business-date";
import { requireAdmin } from "@/server/auth";
import { getPayrollDays, getPayrollYears } from "@/server/queries/payroll-history";

export const metadata: Metadata = { title: "Payroll history" };

const peso = (cents: number) => formatAmountExact(toPesos(cents));
const monthName = (month: string) => format(parseISO(`${month}-01`), "MMMM yyyy");
const href = (year: string, month?: string) =>
  `/admin/payroll/history?year=${year}${month ? `&month=${month}` : ""}`;

const row =
  "grid grid-cols-[1fr_auto] items-baseline gap-x-4 px-4 py-3 sm:px-5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:bg-muted/70";

/** Net pay per year and month (saved payslips) and each day's pay (time record). */
export default function PayrollHistoryPage({ searchParams }: PageProps<"/admin/payroll/history">) {
  return (
    <>
      <PageHeader
        eyebrow="what we paid"
        title="Payroll history"
        description="Total net pay for every year and month, and the pay for every day."
        actions={
          <Button asChild variant="outline" size="lg">
            <Link href="/admin/payroll">
              <ArrowLeftIcon aria-hidden />
              Payroll
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <History searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function History({
  searchParams,
}: Pick<PageProps<"/admin/payroll/history">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const years = await getPayrollYears();
  if (years.length === 0) {
    return (
      <EmptyList
        title="No payroll yet"
        text="Record days on the Payroll page; each cut-off's payslips show up here."
      />
    );
  }

  const today = businessToday();
  const year = years.find((y) => y.year === params.year) ?? years[0]!;
  // The month asked for, else this month (if it has pay), else the year's last month.
  const month =
    year.months.find((m) => m.month === params.month) ??
    year.months.find((m) => m.month === today.slice(0, 7)) ??
    year.months.at(-1)!;
  const days = await getPayrollDays(month.month);
  const daysTotal = days.reduce((s, d) => s + d.payCents, 0);

  return (
    <div className="space-y-10">
      <Years years={years} selected={year.year} />
      <Months year={year} selected={month.month} />

      <section aria-labelledby="days" className="space-y-3">
        <div>
          <h2 id="days" className="text-2xl font-semibold">
            {monthName(month.month)} by day
          </h2>
          <p className="text-sm text-muted-foreground">
            Pay earned each day, from the time record. SSS, PhilHealth and Pag-IBIG come off once
            per cut-off, so they aren&apos;t in the daily figures.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {month.cutoffs.map((c) => (
            <li key={c.start} className="rounded-full border bg-card px-3 py-1">
              {c.label}: <strong className="tabular-nums">{peso(c.netCents)}</strong> net ·{" "}
              {c.people} {c.people === 1 ? "payslip" : "payslips"}
            </li>
          ))}
        </ul>
        {days.length === 0 ? (
          <p className="rounded-3xl border bg-card p-5 text-sm text-muted-foreground">
            No days recorded in {monthName(month.month)}.
          </p>
        ) : (
          <ul
            aria-label={`Days in ${monthName(month.month)}`}
            className="divide-y overflow-hidden rounded-3xl border bg-card"
          >
            {days.map((d) => (
              <li key={d.date}>
                {/* Each day opens to show what every employee earned. */}
                <details className="group">
                  <summary
                    className={cn(
                      row,
                      "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <ChevronRightIcon
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                        aria-hidden
                      />
                      <span>
                        <span className="font-semibold">
                          {format(parseISO(d.date), "EEE d MMM")}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {" "}
                          · {d.people} {d.people === 1 ? "person" : "people"} paid
                        </span>
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{peso(d.payCents)}</span>
                  </summary>
                  <div className="space-y-2 bg-muted/40 px-4 pt-1 pb-3 sm:pl-11">
                    <ul aria-label={`Pay on ${format(parseISO(d.date), "EEE d MMM")}`}>
                      {d.staff.map((p, i) => (
                        <li
                          key={`${p.name}-${i}`}
                          className="flex items-baseline justify-between gap-4 py-1 text-sm"
                        >
                          <span>
                            {p.name}
                            <span className="text-muted-foreground">
                              {" "}
                              · {isDayStatus(p.status) ? dayStatusLabel(p.status) : p.status}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "tabular-nums",
                              p.payCents > 0 ? "font-medium" : "text-muted-foreground",
                            )}
                          >
                            {peso(p.payCents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/admin/payroll?date=${d.date}`}
                      className="inline-block text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      Open this day
                    </Link>
                  </div>
                </details>
              </li>
            ))}
            <li className="flex items-baseline justify-between bg-muted/60 px-4 py-3 font-semibold sm:px-5">
              <span>Days in {format(parseISO(`${month.month}-01`), "MMMM")}</span>
              <span className="tabular-nums">{peso(daysTotal)}</span>
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}

function Years({ years, selected }: { years: YearTotal[]; selected: string }) {
  return (
    <section aria-labelledby="years" className="space-y-3">
      <h2 id="years" className="text-2xl font-semibold">
        By year
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {years.map((y) => {
          const current = y.year === selected;
          return (
            <li key={y.year}>
              <Link
                href={href(y.year)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "block rounded-3xl border p-4 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  current ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                <span className={cn("text-sm", current ? "opacity-90" : "text-muted-foreground")}>
                  {y.year} · net pay
                </span>
                <span className="mt-1 block font-heading text-2xl font-semibold tabular-nums">
                  {peso(y.netCents)}
                </span>
                <span className={cn("text-sm", current ? "opacity-90" : "text-muted-foreground")}>
                  Gross {peso(y.grossCents)} · deductions {peso(y.deductionsCents)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Months({ year, selected }: { year: YearTotal; selected: string }) {
  const months: MonthTotal[] = [...year.months].reverse(); // newest first
  return (
    <section aria-labelledby="months" className="space-y-3">
      <h2 id="months" className="text-2xl font-semibold">
        {year.year} by month
      </h2>
      <ul
        aria-label={`Months in ${year.year}`}
        className="divide-y overflow-hidden rounded-3xl border bg-card"
      >
        {months.map((m) => (
          <li key={m.month}>
            <Link
              href={href(year.year, m.month)}
              aria-current={m.month === selected ? "page" : undefined}
              className={row}
            >
              <span>
                <span className="font-semibold">{monthName(m.month)}</span>
                <span className="block text-sm text-muted-foreground">
                  Gross {peso(m.grossCents)} · deductions {peso(m.deductionsCents)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-xs text-muted-foreground">Net pay</span>
                <span className="font-semibold tabular-nums">{peso(m.netCents)}</span>
              </span>
            </Link>
          </li>
        ))}
        <li className="flex items-baseline justify-between bg-muted/60 px-4 py-3 font-semibold sm:px-5">
          <span>Total {year.year}</span>
          <span className="tabular-nums">{peso(year.netCents)}</span>
        </li>
      </ul>
    </section>
  );
}
