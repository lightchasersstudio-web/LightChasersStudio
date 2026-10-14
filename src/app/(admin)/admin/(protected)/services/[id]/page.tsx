import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PageHeader } from "@/components/admin/page-header";
import { ServiceForm } from "@/components/admin/service-form";
import { requireAdmin } from "@/server/auth";
import { getServiceForAdmin } from "@/server/queries/services";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({ params }: PageProps<"/admin/services/[id]">) {
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
