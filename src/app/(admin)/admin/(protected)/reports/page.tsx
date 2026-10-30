import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/admin/page-header";
import { ExportBookings } from "@/components/admin/reports/export-bookings";
import { SalesReport } from "@/components/admin/reports/sales-report";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/server/auth";
import { getSalesMonths } from "@/server/queries/reports";

export const metadata: Metadata = { title: "Sales report" };

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        eyebrow="how the studio is doing"
        title="Sales report"
        description="Sales, bookings and payments at a glance."
      />
      <ExportBookings />
      <Suspense fallback={<ReportSkeleton />}>
        <Report />
      </Suspense>
    </>
  );
}

async function Report() {
  await requireAdmin();
  return <SalesReport months={await getSalesMonths(24)} />;
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
