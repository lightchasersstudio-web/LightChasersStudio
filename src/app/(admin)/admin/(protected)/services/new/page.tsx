import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminOnly } from "@/components/admin/admin-only";
import { PageHeader } from "@/components/admin/page-header";
import { ServiceForm } from "@/components/admin/service-form";
import { FormSkeleton } from "@/components/admin/skeletons";

export const metadata: Metadata = { title: "New service" };

export default function NewServicePage() {
  return (
    <>
      <PageHeader eyebrow="something new" title="New service" />
      <Suspense fallback={<FormSkeleton fields={6} />}>
        <AdminOnly>
          <ServiceForm />
        </AdminOnly>
      </Suspense>
    </>
  );
}
