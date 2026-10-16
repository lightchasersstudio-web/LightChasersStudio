import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AddOnsManager } from "@/components/admin/add-ons-manager";
import { PageHeader } from "@/components/admin/page-header";
import { ServicesList } from "@/components/admin/services-list";
import { ListSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/server/auth";
import { listAddOnsForAdmin } from "@/server/queries/add-ons";
import { listServicesForAdmin } from "@/server/queries/services";

export const metadata: Metadata = { title: "Services" };

export default function AdminServicesPage() {
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
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <Services />
      </Suspense>
    </>
  );
}

async function Services() {
  await requireAdmin();
  const [services, addOns] = await Promise.all([listServicesForAdmin(), listAddOnsForAdmin()]);
  return (
    <>
      <ServicesList services={services} />
      <AddOnsManager addOns={addOns} />
    </>
  );
}
