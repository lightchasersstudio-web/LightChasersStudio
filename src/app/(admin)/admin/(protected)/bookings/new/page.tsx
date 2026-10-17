import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AdminBookingForm } from "@/components/admin/bookings/admin-booking-form";
import { PageHeader } from "@/components/admin/page-header";
import { FormSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/server/auth";
import { listAddOnsForAdmin } from "@/server/queries/add-ons";
import { listServicesForAdmin } from "@/server/queries/services";

export const metadata: Metadata = { title: "New booking" };

export default function NewBookingPage({ searchParams }: PageProps<"/admin/bookings/new">) {
  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3">
        <Link href="/admin/calendar">
          <ArrowLeftIcon aria-hidden />
          Calendar
        </Link>
      </Button>
      <PageHeader
        eyebrow="booked over chat or in person"
        title="New booking"
        description="Book a client in yourself. It's confirmed straight away and never goes over your shoots-at-once limit."
      />
      <Suspense fallback={<FormSkeleton fields={8} />}>
        <NewBooking searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewBooking({
  searchParams,
}: Pick<PageProps<"/admin/bookings/new">, "searchParams">) {
  await requireAdmin();
  const [params, services, addOns] = await Promise.all([
    searchParams,
    listServicesForAdmin(),
    listAddOnsForAdmin(),
  ]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one(params.date) ?? "") ? one(params.date)! : null;
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(one(params.time) ?? "") ? one(params.time)! : null;

  if (services.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed p-8 text-center text-muted-foreground">
        Add a package in Services first.
      </p>
    );
  }
  return (
    <AdminBookingForm
      // A new date/time from the calendar starts a fresh form.
      key={`${date}-${time}`}
      packages={services.map((s) => ({
        id: s.id,
        name: s.name,
        priceCents: s.price_cents,
        active: s.is_active,
      }))}
      addOnCatalog={addOns.map((a) => ({
        id: a.id,
        name: a.name,
        priceCents: a.price_cents,
        active: a.is_active,
      }))}
      initialDate={date}
      initialTime={time}
    />
  );
}
