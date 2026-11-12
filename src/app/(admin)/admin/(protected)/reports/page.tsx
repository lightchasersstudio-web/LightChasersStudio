import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/admin/page-header";
import { DailyPayrollReport } from "@/components/admin/reports/daily-payroll-report";
import { ExportBookings } from "@/components/admin/reports/export-bookings";
import { SalesReport } from "@/components/admin/reports/sales-report";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDailyPayrollFilter, parseReportDate } from "@/lib/payroll/daily-report";
import { businessToday } from "@/lib/utils/business-date";
import { requireAdmin } from "@/server/auth";
import { getDailyPayroll } from "@/server/queries/daily-payroll";
import { getSalesMonths } from "@/server/queries/reports";

export const metadata: Metadata = { title: "Sales report" };

export default function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <>
      <PageHeader
        eyebrow="how the studio is doing"
        title="Sales report"
        description="Sales, bookings, payments and daily payroll at a glance."
      />
      <ExportBookings />
      <Suspense fallback={<ReportSkeleton />}>
        <Report searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Report({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  await requireAdmin();
  return (
    <SalesReport
      months={await getSalesMonths(24)}
      payroll={
        <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
          <Payroll searchParams={searchParams} />
        </Suspense>
      }
    />
  );
}

/** Sales report → Payroll (below Workshop): one Manila day, ?payDate=&payCategory=. */
async function Payroll({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const today = businessToday();
  const date = parseReportDate(params.payDate) ?? today;
  const report = await getDailyPayroll(date, parseDailyPayrollFilter(params.payCategory));
  return <DailyPayrollReport report={report} today={today} />;
}

function ReportSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-6">
      <Skeleton className="h-11 w-80 max-w-full rounded-full" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-3xl" />
    </div>
  );
}
