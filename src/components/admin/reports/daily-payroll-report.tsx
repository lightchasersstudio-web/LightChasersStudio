import { format, parseISO } from "date-fns";
import { CalendarX2Icon, FileDownIcon, PencilIcon, UsersRoundIcon, WalletIcon } from "lucide-react";
import Link from "next/link";

import { EmployeeCategoryBadge } from "@/components/admin/payroll/employee-category-badge";
import { DailyPayrollControls } from "@/components/admin/reports/daily-payroll-controls";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dayStatusLabel } from "@/lib/payroll/cutoff";
import {
  DAILY_PAYROLL_NOTE,
  endsNextDay,
  formatClock,
  type DailyPayroll,
  type DailyPayrollFilter,
} from "@/lib/payroll/daily-report";
import { categoryLabel } from "@/lib/payroll/employees";
import { formatAmountExact } from "@/lib/payroll/money";
import { cn } from "@/lib/utils";

/** Sales report → Payroll: what the studio pays its staff for one day. */
export function DailyPayrollReport({ report, today }: { report: DailyPayroll; today: string }) {
  const { date, filter, rows, total, paidCount, subtotals } = report;
  const dayLabel = format(parseISO(date), "EEEE, d MMMM yyyy");
  const pdfHref = `/admin/reports/payroll/pdf?date=${date}${filter === "all" ? "" : `&category=${filter}`}`;
  const dtrHref = `/admin/payroll?date=${date}`;
  const filterHref = (f: DailyPayrollFilter) => {
    const q = new URLSearchParams();
    if (date !== today) q.set("payDate", date);
    if (f !== "all") q.set("payCategory", f);
    return `/admin/reports${q.size ? `?${q}` : ""}#payroll`;
  };

  return (
    <section
      id="payroll"
      aria-labelledby="payroll-title"
      className="scroll-mt-20 rounded-3xl border bg-card p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="payroll-title" className="text-xl font-semibold">
            Payroll
          </h2>
          <p className="text-sm text-muted-foreground">
            What the studio pays its staff for one day, from the time record.
          </p>
        </div>
        {report.hasRecords && (
          <Button asChild variant="outline" size="sm">
            {/* A route handler: a plain link that opens the PDF in a new tab. */}
            <a href={pdfHref} target="_blank" rel="noopener">
              <FileDownIcon aria-hidden />
              Print / save PDF
            </a>
          </Button>
        )}
      </div>

      <div className="mt-5">
        <DailyPayrollControls
          date={date}
          today={today}
          filter={filter}
          hasUncategorized={subtotals.some((s) => s.value === "none")}
        />
      </div>

      {!report.hasRecords ? (
        <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center">
          <CalendarX2Icon className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-semibold">Nothing recorded for {dayLabel}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Once staff time is recorded for this day, what you owe them shows up here.
          </p>
          <Button asChild variant="outline">
            <Link href={dtrHref}>Open the time record</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div className="rounded-3xl bg-primary p-5 text-primary-foreground">
              <p className="flex items-center gap-2 text-sm font-semibold opacity-90">
                <WalletIcon className="size-4" aria-hidden />
                Total payroll
                {filter !== "all" && ` · ${categoryLabel(filter === "none" ? null : filter)}`}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums sm:text-4xl">
                {formatAmountExact(total)}
              </p>
              <p className="mt-1 text-sm opacity-90">{dayLabel}</p>
            </div>
            <div className="rounded-3xl border p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <UsersRoundIcon className="size-4" aria-hidden />
                Employees paid
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{paidCount}</p>
              <p className="mt-1 text-sm text-muted-foreground">of {rows.length} with a record</p>
            </div>
          </div>

          <ul
            aria-label="By category"
            className={cn(
              "mt-3 grid grid-cols-2 gap-3",
              subtotals.length > 3 ? "lg:grid-cols-4" : "sm:grid-cols-3",
            )}
          >
            {subtotals.map((s) => {
              const active = filter === s.value;
              return (
                <li key={s.value}>
                  <Link
                    href={filterHref(active ? "all" : s.value)}
                    scroll={false}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "block h-full rounded-2xl p-4 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      active ? "bg-secondary ring-2 ring-primary" : "bg-muted/60 hover:bg-muted",
                    )}
                  >
                    <span className="block text-sm font-semibold text-muted-foreground">
                      {s.label}
                    </span>
                    <span className="mt-1 block text-xl font-semibold tabular-nums">
                      {formatAmountExact(s.pay)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {s.people} {s.people === 1 ? "person" : "people"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {rows.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No {categoryLabel(filter === "none" ? null : filter).toLowerCase()} staff recorded on
              this day.{" "}
              <Link
                href={filterHref("all")}
                scroll={false}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Show all staff
              </Link>
            </p>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border">
              <Table className="min-w-[46rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Employee</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time in</TableHead>
                    <TableHead>Time out</TableHead>
                    <TableHead className="text-right">Daily rate</TableHead>
                    <TableHead className="pr-4 text-right">Pay for the day</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.employeeId}
                      className={cn(r.pay === 0 && "text-muted-foreground")}
                    >
                      <TableCell className="pl-4">
                        <span className="font-semibold text-foreground">{r.name}</span>
                        <span className="block text-muted-foreground">{r.position}</span>
                      </TableCell>
                      <TableCell>
                        <EmployeeCategoryBadge category={r.category} />
                      </TableCell>
                      <TableCell>{dayStatusLabel(r.status)}</TableCell>
                      <TableCell className="tabular-nums">{formatClock(r.timeIn)}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatClock(r.timeOut)}
                        {endsNextDay(r.timeIn, r.timeOut) && (
                          <span className="block text-xs text-muted-foreground">next day</span>
                        )}
                        {r.timeOutEdited && (
                          <span className="flex items-center gap-1 text-xs text-terracotta-ink">
                            <PencilIcon className="size-3" aria-hidden />
                            edited
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmountExact(r.dailyRate)}
                      </TableCell>
                      <TableCell className="pr-4 text-right font-semibold text-foreground tabular-nums">
                        {formatAmountExact(r.pay)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={6} className="pl-4 font-semibold">
                      Total
                    </TableCell>
                    <TableCell className="pr-4 text-right font-semibold tabular-nums">
                      {formatAmountExact(total)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}

          <p className="mt-3 text-sm text-muted-foreground">{DAILY_PAYROLL_NOTE}</p>
        </>
      )}
    </section>
  );
}
