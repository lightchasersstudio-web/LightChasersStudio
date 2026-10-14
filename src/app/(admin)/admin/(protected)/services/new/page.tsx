import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { ServiceForm } from "@/components/admin/service-form";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "New service" };

export default async function NewServicePage() {
  await requireAdmin();
  return (
    <>
      <PageHeader eyebrow="something new" title="New service" />
      <ServiceForm />
    </>
  );
}
