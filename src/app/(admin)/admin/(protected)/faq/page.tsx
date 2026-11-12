import type { Metadata } from "next";
import { Suspense } from "react";

import { FaqManager } from "@/components/admin/faq-manager";
import { PageHeader } from "@/components/admin/page-header";
import { ListSkeleton } from "@/components/admin/skeletons";
import { requireAdmin } from "@/server/auth";
import { listFaqsForAdmin } from "@/server/queries/faq";

export const metadata: Metadata = { title: "FAQ" };

export default function AdminFaqPage() {
  return (
    <>
      <PageHeader
        eyebrow="good to know"
        title="Questions & answers"
        description="What clients see on the FAQ page. Switch a question off to hide it, and use the arrows to set the order within each topic."
      />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <Faqs />
      </Suspense>
    </>
  );
}

async function Faqs() {
  await requireAdmin();
  return <FaqManager faqs={await listFaqsForAdmin()} />;
}
