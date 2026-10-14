import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { PortfolioGrid } from "@/components/admin/portfolio-grid";
import { PortfolioUploader } from "@/components/admin/portfolio-uploader";
import { requireAdmin } from "@/server/auth";
import { listPortfolioForAdmin } from "@/server/queries/portfolio";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  await requireAdmin();
  const images = await listPortfolioForAdmin();

  return (
    <>
      <PageHeader
        eyebrow="your best work"
        title="Portfolio"
        description="Photos for the public gallery. Star a photo to feature it on the home page."
      />
      <div className="space-y-10">
        <PortfolioUploader />
        <PortfolioGrid images={images} />
      </div>
    </>
  );
}
