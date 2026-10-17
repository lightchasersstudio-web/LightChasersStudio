import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminOnly } from "@/components/admin/admin-only";
import { PageHeader } from "@/components/admin/page-header";
import { ExportBookings } from "@/components/admin/reports/export-bookings";
import { SalesReport } from "@/components/admin/reports/sales-report";
import { Skeleton } from "@/components/ui/skeleton";

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
      <p className="mb-6 flex items-start gap-2 rounded-2xl border border-dashed border-terracotta/50 bg-blush/50 px-4 py-3 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
        <span>
          <strong>Sample numbers.</strong> This report is a preview with made-up figures. Your real
          sales will show here once it&apos;s connected to your bookings.
        </span>
      </p>
      <Suspense fallback={<ReportSkeleton />}>
        <AdminOnly>
          <SalesReport />
        </AdminOnly>
      </Suspense>
    </>
  );
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
