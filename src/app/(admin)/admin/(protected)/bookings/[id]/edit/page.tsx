import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminBookingEditForm } from "@/components/admin/bookings/admin-booking-edit-form";
import { PageHeader } from "@/components/admin/page-header";
import { FormSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { centsToPesoInput } from "@/lib/utils/money";
import { requireAdmin } from "@/server/auth";
import { listAddOnsForAdmin } from "@/server/queries/add-ons";
import { getBookingForAdmin } from "@/server/queries/bookings";
import { listServicesForAdmin } from "@/server/queries/services";

export const metadata: Metadata = { title: "Edit booking" };

export default function EditBookingPage({ params }: PageProps<"/admin/bookings/[id]/edit">) {
  return (
    <Suspense fallback={<FormSkeleton fields={8} />}>
      <EditBooking params={params} />
    </Suspense>
  );
}

async function EditBooking({ params }: Pick<PageProps<"/admin/bookings/[id]/edit">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const b = /^[0-9a-f-]{36}$/i.test(id) ? await getBookingForAdmin(id) : null;
  if (!b) notFound();
  const [services, addOns] = await Promise.all([listServicesForAdmin(), listAddOnsForAdmin()]);
  const back = (
    <Button asChild variant="ghost" className="mb-2 -ml-3">
      <Link href={`/admin/bookings/${b.id}`}>
        <ArrowLeftIcon aria-hidden />
        Booking
      </Link>
    </Button>
  );

  if (!["pending", "confirmed"].includes(b.status)) {
    return (
      <>
        {back}
        <PageHeader eyebrow="edit booking" title={b.contact_name} />
        <p className="rounded-3xl border border-dashed p-8 text-center text-muted-foreground">
          Only bookings that need your OK or are confirmed can be changed.
        </p>
      </>
    );
  }

  const start = new TZDate(b.start_at, BUSINESS_TZ);
  const addOnsCents = b.add_ons.reduce((sum, a) => sum + a.price_cents, 0);
  return (
    <>
      {back}
      <PageHeader
        eyebrow={`edit booking · ${b.reference_code}`}
        title={b.contact_name}
        description="Change the time, package, price, add-ons or details. The slot is checked again before saving."
      />
      <AdminBookingEditForm
        initial={{
          bookingId: b.id,
          serviceId: b.service_id,
          date: format(start, "yyyy-MM-dd"),
          time: format(start, "HH:mm"),
          // The stored total includes add-ons and VAT; the form edits the package part.
          price: centsToPesoInput(b.price_cents - b.vat_cents - addOnsCents),
          fullName: b.contact_name,
          phone: b.contact_phone,
          preferredContact: b.preferred_contact === "viber" ? "phone" : b.preferred_contact,
          messenger: b.messenger ?? "",
          location: b.location ?? "",
          participants: String(b.participants),
          specialRequests: b.special_requests ?? "",
          addOns: b.add_ons.map((a) => ({
            addOnId: a.add_on_id ?? "",
            name: a.name,
            price: centsToPesoInput(a.price_cents),
          })),
          chargeVat: b.vat_cents > 0,
          emailClient: Boolean(b.email),
          allowOutsideHours: false,
        }}
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
        vatPercent={b.vatPercent}
        paidCents={b.paidCents}
        hasEmail={Boolean(b.email)}
      />
    </>
  );
}
