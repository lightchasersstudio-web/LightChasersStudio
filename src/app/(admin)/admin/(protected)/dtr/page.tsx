import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { EmptyList } from "@/components/admin/lists/pager";
import { PageHeader } from "@/components/admin/page-header";
import { AttendanceSheet } from "@/components/admin/payroll/attendance-sheet";
import { CutoffPicker } from "@/components/admin/payroll/cutoff-picker";
import { EmployeePicker } from "@/components/admin/payroll/employee-picker";
import { ListSkeleton } from "@/components/admin/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  currentCutoff,
  cutoffDates,
  cutoffLabel,
  daysWorked,
  formatMinutes,
  parseCutoff,
  type Cutoff,
} from "@/lib/payroll/cutoff";
import { asSalaryType, salaryRates } from "@/lib/payroll/employees";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { requireAdmin } from "@/server/auth";
import { getAttendance, getCutoffSummary, getPayrollSavedAt } from "@/server/queries/attendance";
import { getContributionRates } from "@/server/queries/employees";

export const metadata: Metadata = { title: "Time record" };

export default function DtrPage({ searchParams }: PageProps<"/admin/dtr">) {
  return (
    <>
      <PageHeader
        eyebrow="who worked when"
        title="Time record"
        description="Daily time record per cut-off. Mark each day present, AM or PM shift, rest day, absent, leave or holiday; hours are worked out from the time in and out."
        actions={
          <Button asChild variant="outline" size="lg">
            <Link href="/admin/payroll/settings">
              <SlidersHorizontalIcon aria-hidden />
              Payroll settings
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <Dtr searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Dtr({ searchParams }: Pick<PageProps<"/admin/dtr">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const current = currentCutoff();
  const cutoff = parseCutoff(params.cutoff) ?? current;
  const employeeId =
    typeof params.employee === "string" && z.uuid().safeParse(params.employee).success
      ? params.employee
      : null;

  const [summary, savedAt] = await Promise.all([
    getCutoffSummary(cutoff),
    getPayrollSavedAt(cutoff),
  ]);
  const selected = employeeId ? summary.find((s) => s.id === employeeId) : undefined;
  const href = (start: string) =>
    `/admin/dtr?cutoff=${start}${selected ? `&employee=${selected.id}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <CutoffPicker cutoff={cutoff} current={current} href={href} />
        {selected && (
          <EmployeePicker
            employees={summary.map((s) => ({ id: s.id, name: s.name }))}
            value={selected.id}
            cutoff={cutoff.start}
          />
        )}
      </div>

      {savedAt && (
        <p className="flex gap-2 rounded-2xl border border-terracotta/40 bg-blush/40 p-4 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
          <span>
            The payroll for {cutoffLabel(cutoff)} was saved on{" "}
            {format(new TZDate(savedAt, BUSINESS_TZ), "d MMM yyyy, h:mm a")}. If you change the time
            record, make the payroll again so the payslips match.
          </span>
        </p>
      )}

      {selected ? (
        <Sheet cutoff={cutoff} employee={selected} />
      ) : (
        <Summary cutoff={cutoff} summary={summary} />
      )}
    </div>
  );
}

async function Sheet({
  cutoff,
  employee,
}: {
  cutoff: Cutoff;
  employee: { id: string; name: string; isActive: boolean; salaryType: string; salaryRate: number };
}) {
  const [logs, rates] = await Promise.all([
    getAttendance(employee.id, cutoff),
    getContributionRates(),
  ]);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" className="-ml-3">
          <Link href={`/admin/dtr?cutoff=${cutoff.start}`}>
            <ArrowLeftIcon aria-hidden />
            All staff
          </Link>
        </Button>
        <h2 className="text-2xl font-semibold">{employee.name}</h2>
        {!employee.isActive && <Badge variant="secondary">Inactive</Badge>}
      </div>
      <AttendanceSheet
        key={`${employee.id}-${cutoff.start}`}
        employeeId={employee.id}
        employeeName={employee.name}
        cutoff={cutoff.start}
        dates={cutoffDates(cutoff)}
        logs={logs}
        hoursPerDay={rates.hoursPerDay}
        currentRate={
          salaryRates(
            asSalaryType(employee.salaryType),
            employee.salaryRate,
            rates.workDaysPerMonth,
          ).daily
        }
      />
    </>
  );
}

function Summary({
  cutoff,
  summary,
}: {
  cutoff: Cutoff;
  summary: Awaited<ReturnType<typeof getCutoffSummary>>;
}) {
  if (summary.length === 0) {
    return (
      <EmptyList
        title="No employees yet"
        text="Add your team under Employees, then record their days here."
      />
    );
  }
  const days = cutoffDates(cutoff).length;
  return (
    <>
      {/* Phones: a card per person (the table is too wide). */}
      <ul className="space-y-3 xl:hidden" aria-label="Time records">
        {summary.map((s) => (
          <li key={s.id}>
            <Link
              href={`/admin/dtr?cutoff=${cutoff.start}&employee=${s.id}`}
              className="block rounded-3xl border bg-card p-4 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-semibold break-words">
                    {s.name}
                    {!s.isActive && (
                      <Badge variant="secondary" className="ml-2">
                        Inactive
                      </Badge>
                    )}
                  </span>
                  <span className="block text-sm text-muted-foreground">{s.position}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
                  Open
                  <ArrowRightIcon className="size-4" aria-hidden />
                </span>
              </span>
              <span className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-muted/60 p-3 text-sm">
                <span>
                  <span className="block text-xs text-muted-foreground">Recorded</span>
                  <span
                    className={
                      s.recorded < days
                        ? "text-muted-foreground tabular-nums"
                        : "font-semibold tabular-nums"
                    }
                  >
                    {s.recorded}/{days}
                  </span>
                </span>
                <span>
                  <span className="block text-xs text-muted-foreground">Worked</span>
                  <span className="font-semibold tabular-nums">{daysWorked(s.totals)}</span>
                </span>
                <span>
                  <span className="block text-xs text-muted-foreground">Hours</span>
                  <span className="font-semibold tabular-nums">
                    {formatMinutes(s.totals.minutes)}
                  </span>
                </span>
                {s.totals.am +
                  s.totals.pm +
                  s.totals.rest_day +
                  s.totals.absent +
                  s.totals.leave +
                  s.totals.holiday >
                  0 && (
                  <span className="col-span-3 text-xs text-muted-foreground">
                    {[
                      s.totals.am && `${s.totals.am} AM`,
                      s.totals.pm && `${s.totals.pm} PM`,
                      s.totals.rest_day && `${s.totals.rest_day} rest`,
                      s.totals.absent && `${s.totals.absent} absent`,
                      s.totals.leave && `${s.totals.leave} leave`,
                      s.totals.holiday && `${s.totals.holiday} holiday`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-3xl border bg-card xl:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Employee</TableHead>
              <TableHead className="text-right">Present</TableHead>
              <TableHead className="text-right">AM / PM</TableHead>
              <TableHead className="text-right">Rest</TableHead>
              <TableHead className="text-right">Absent</TableHead>
              <TableHead className="text-right">Leave</TableHead>
              <TableHead className="text-right">Holiday</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Recorded</TableHead>
              <TableHead className="pr-5">
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="pl-5">
                  <span className="font-semibold">{s.name}</span>
                  {!s.isActive && (
                    <Badge variant="secondary" className="ml-2">
                      Inactive
                    </Badge>
                  )}
                  <span className="block text-muted-foreground">{s.position}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{s.totals.present}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.totals.am} / {s.totals.pm}
                </TableCell>
                <TableCell className="text-right tabular-nums">{s.totals.rest_day}</TableCell>
                <TableCell className="text-right tabular-nums">{s.totals.absent}</TableCell>
                <TableCell className="text-right tabular-nums">{s.totals.leave}</TableCell>
                <TableCell className="text-right tabular-nums">{s.totals.holiday}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMinutes(s.totals.minutes)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className={s.recorded < days ? "text-muted-foreground" : "font-semibold"}>
                    {s.recorded}/{days}
                  </span>
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/admin/dtr?cutoff=${cutoff.start}&employee=${s.id}`}
                      aria-label={`Open ${s.name}'s time record`}
                    >
                      Open
                      <ArrowRightIcon aria-hidden />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
