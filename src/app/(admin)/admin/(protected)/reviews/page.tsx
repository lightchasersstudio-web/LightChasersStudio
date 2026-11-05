import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/admin/page-header";
import { ReviewsManager } from "@/components/admin/reviews-manager";
import { ListSkeleton } from "@/components/admin/skeletons";
import { requireAdmin } from "@/server/auth";
import { listReviewsForAdmin } from "@/server/queries/reviews";

export const metadata: Metadata = { title: "Reviews" };

export default function AdminReviewsPage() {
  return (
    <>
      <PageHeader
        eyebrow="kind words"
        title="Client reviews"
        description="Shown on the home page, and on package pages for the same kind of shoot. Use the arrows to set the order."
      />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Reviews />
      </Suspense>
    </>
  );
}

async function Reviews() {
  await requireAdmin();
  return <ReviewsManager reviews={await listReviewsForAdmin()} />;
}
