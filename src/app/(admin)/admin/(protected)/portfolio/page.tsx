import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminOnly } from "@/components/admin/admin-only";
import { PageHeader } from "@/components/admin/page-header";
import { PortfolioGrid } from "@/components/admin/portfolio-grid";
import { PortfolioUploader } from "@/components/admin/portfolio-uploader";
import { FormSkeleton, GridSkeleton } from "@/components/admin/skeletons";
import { requireAdmin } from "@/server/auth";
import { listPortfolioForAdmin } from "@/server/queries/portfolio";
import { listServicesForAdmin } from "@/server/queries/services";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <>
      <PageHeader
        eyebrow="your best work"
        title="Portfolio"
        description="Photos for the public gallery. Star a photo to feature it on the home page."
      />
      <div className="space-y-10">
        <Suspense fallback={<FormSkeleton fields={2} />}>
          <AdminOnly>
            <PortfolioUploader />
          </AdminOnly>
        </Suspense>
        <Suspense fallback={<GridSkeleton />}>
          <Photos />
        </Suspense>
      </div>
    </>
  );
}

async function Photos() {
  await requireAdmin();
  const [images, services] = await Promise.all([listPortfolioForAdmin(), listServicesForAdmin()]);
  const packages = services.map((s) => ({
    value: s.id,
    label: s.is_active ? s.name : `${s.name} (hidden)`,
  }));
  return <PortfolioGrid images={images} packages={packages} />;
}
