import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { ServicesList } from "@/components/admin/services-list";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/server/auth";
import { listServicesForAdmin } from "@/server/queries/services";

export const metadata: Metadata = { title: "Services" };

export default async function AdminServicesPage() {
  await requireAdmin();
  const services = await listServicesForAdmin();

  return (
    <>
      <PageHeader
        eyebrow="what you offer"
        title="Services & packages"
        description="Clients book these. Use the arrows to set the order they appear in."
        actions={
          <Button asChild size="lg">
            <Link href="/admin/services/new">
              <PlusIcon aria-hidden />
              New service
            </Link>
          </Button>
        }
      />
      <ServicesList services={services} />
    </>
  );
}
