import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { PageHeader } from "@/components/admin/page-header";
import { ServiceForm } from "@/components/admin/service-form";
import { FormSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/server/auth";
import { getServiceForAdmin } from "@/server/queries/services";

export const metadata: Metadata = { title: "Edit service" };

export default function EditServicePage({ params }: PageProps<"/admin/services/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <Skeleton className="h-10 w-72" />
          <FormSkeleton fields={6} />
        </div>
      }
    >
      <EditService params={params} />
    </Suspense>
  );
}

async function EditService({ params }: Pick<PageProps<"/admin/services/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const service = await getServiceForAdmin(id);
  if (!service) notFound();

  return (
    <>
      <PageHeader eyebrow="editing" title={service.name} />
      {/* key: reset the form when navigating between services */}
      <ServiceForm key={service.id} service={service} />
    </>
  );
}
