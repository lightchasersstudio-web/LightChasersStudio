import { SlidersHorizontalIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyList } from "@/components/admin/lists/pager";
import { PageHeader } from "@/components/admin/page-header";
import { DayAttendanceSheet } from "@/components/admin/payroll/day-attendance-sheet";
import { DtrViewTabs } from "@/components/admin/payroll/dtr-view-tabs";
import { PayrollSavedNotice } from "@/components/admin/payroll/payroll-saved-notice";
import { PayrollSteps } from "@/components/admin/payroll/payroll-steps";
import { ListSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { cutoffFor } from "@/lib/payroll/cutoff";
import { asSalaryType, salaryRates } from "@/lib/payroll/employees";
import { businessToday } from "@/lib/utils/business-date";
import { dateString } from "@/lib/validations/shared";
import { requireAdmin } from "@/server/auth";
import { getDayAttendance } from "@/server/queries/attendance";
import { getContributionRates } from "@/server/queries/employees";
import { getPayrollFlow } from "@/server/queries/payroll-flow";

export const metadata: Metadata = { title: "Time record · by day" };

export default function DtrDayPage({ searchParams }: PageProps<"/admin/dtr/day">) {
  return (
    <>
      <PageHeader
        eyebrow="who worked when"
        title="Time record"
        description="Who worked when. Fill in the whole team day by day, or one person's whole cut-off; hours are worked out from the time in and out."
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
        <DayView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DayView({ searchParams }: Pick<PageProps<"/admin/dtr/day">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const today = businessToday();
  const parsed = dateString.safeParse(params.date);
  const date = parsed.success ? parsed.data : today;
  const cutoff = cutoffFor(date);

  const [staff, rates, { flow }] = await Promise.all([
    getDayAttendance(date),
    getContributionRates(),
    getPayrollFlow(cutoff),
  ]);

  return (
    <div className="space-y-6">
      <PayrollSteps cutoff={cutoff} flow={flow} page="record" />
      <DtrViewTabs view="day" date={date} cutoffStart={cutoff.start} />
      <PayrollSavedNotice cutoff={cutoff} flow={flow} />
      {staff.length === 0 ? (
        <EmptyList
          title="No employees yet"
          text="Add your team under Employees, then record their days here."
        />
      ) : (
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
            currentRate: salaryRates(
              asSalaryType(s.salaryType),
              s.salaryRate,
              rates.workDaysPerMonth,
            ).daily,
            log: s.log && {
              status: s.log.status,
              timeIn: s.log.timeIn,
              timeOut: s.log.timeOut,
              dailyRate: s.log.dailyRate,
              note: s.log.note,
            },
          }))}
        />
      )}
    </div>
  );
}
