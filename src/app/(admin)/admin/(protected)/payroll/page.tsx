import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { FileDownIcon, HistoryIcon, SlidersHorizontalIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyList } from "@/components/admin/lists/pager";
import { PageHeader } from "@/components/admin/page-header";
import { DayAttendanceSheet } from "@/components/admin/payroll/day-attendance-sheet";
import { PayslipList } from "@/components/admin/payroll/payslip-list";
import { ListSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { cutoffFor, cutoffLabel, parseCutoff } from "@/lib/payroll/cutoff";
import { asSalaryType, salaryRates } from "@/lib/payroll/employees";
import { BUSINESS_TZ, businessToday } from "@/lib/utils/business-date";
import { dateString } from "@/lib/validations/shared";
import { requireAdmin } from "@/server/auth";
import { cutoffEnded } from "@/server/payroll-sync";
import { getDayAttendance } from "@/server/queries/attendance";
import { getContributionRates } from "@/server/queries/employees";
import { computePayroll, getSavedPayroll } from "@/server/queries/payroll";

export const metadata: Metadata = { title: "Payroll" };

/**
 * Payroll on one page (owner request 2026-11-14): pick a day, set who came,
 * save; the cut-off's payslips below update by themselves.
 */
export default function PayrollPage({ searchParams }: PageProps<"/admin/payroll">) {
  return (
    <>
      <PageHeader
        eyebrow="pay day"
        title="Payroll"
        description="Pick a day, set who came, and save. The payslips below update by themselves."
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/admin/payroll/history">
                <HistoryIcon aria-hidden />
                History
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/admin/payroll/settings">
                <SlidersHorizontalIcon aria-hidden />
                Payroll settings
              </Link>
            </Button>
          </>
        }
      />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <Payroll searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Payroll({ searchParams }: Pick<PageProps<"/admin/payroll">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const today = businessToday();
  // ?date=YYYY-MM-DD; old links with ?cutoff= open that cut-off's first day.
  const parsed = dateString.safeParse(params.date);
  const date = parsed.success ? parsed.data : (parseCutoff(params.cutoff)?.start ?? today);
  const cutoff = cutoffFor(date);
  const ended = cutoffEnded(cutoff, today);

  const [staff, rates, fresh, saved] = await Promise.all([
    getDayAttendance(date),
    getContributionRates(),
    computePayroll(cutoff),
    getSavedPayroll(cutoff),
  ]);
  // A finished cut-off shows what was saved (later raises don't change past pay);
  // a running one shows today's figures.
  const payslips = ended && saved ? saved.payslips : fresh;
  const label = cutoffLabel(cutoff);

  if (staff.length === 0) {
    return (
      <EmptyList
        title="No employees yet"
        text="Add your team under Employees, then record their days here."
      />
    );
  }

  return (
    <div className="space-y-10">
      <DayAttendanceSheet
        // A new day starts a fresh form.
        key={date}
        date={date}
        today={today}
        hoursPerDay={rates.hoursPerDay}
        amPmRate={rates.amPmRate}
        staff={staff.map((s) => ({
          id: s.id,
          name: s.name,
          position: s.position,
          currentRate: salaryRates(asSalaryType(s.salaryType), s.salaryRate, rates.workDaysPerMonth)
            .daily,
          overtimeRate: s.overtimeRate,
          log: s.log && {
            status: s.log.status,
            timeIn: s.log.timeIn,
            timeOut: s.log.timeOut,
            dailyRate: s.log.dailyRate,
            note: s.log.note,
          },
        }))}
      />

      <section aria-labelledby="payslips" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="payslips" className="text-2xl font-semibold">
              Payslips · {label}
            </h2>
            <p className="text-sm text-muted-foreground">
              {ended && saved
                ? `This cut-off is over. Saved ${format(new TZDate(saved.savedAt, BUSINESS_TZ), "d MMM yyyy, h:mm a")}.`
                : "Worked out from the days saved so far."}
            </p>
          </div>
          {payslips.length > 0 && (
            <Button asChild size="lg">
              {/* A route handler: a plain link opens the PDF in a new tab. */}
              <a href={`/admin/payroll/pdf?cutoff=${cutoff.start}`} target="_blank" rel="noopener">
                <FileDownIcon aria-hidden />
                Print all payslips
              </a>
            </Button>
          )}
        </div>
        {payslips.length === 0 ? (
          <p className="rounded-3xl border bg-card p-5 text-sm text-muted-foreground">
            No payslips for this cut-off.
          </p>
        ) : (
          <PayslipList
            key={cutoff.start}
            payslips={payslips}
            cutoffLabel={label}
            cutoffStart={cutoff.start}
          />
        )}
      </section>
    </div>
  );
}
