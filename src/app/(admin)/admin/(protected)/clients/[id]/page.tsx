import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ArrowLeftIcon, MailIcon, PhoneIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AnonymiseClient } from "@/components/admin/clients/anonymise-client";
import { BookingRows } from "@/components/admin/lists/booking-rows";
import { EmptyList } from "@/components/admin/lists/pager";
import { PageHeader } from "@/components/admin/page-header";
import { DetailSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatPeso } from "@/lib/utils/money";
import { CONTACT_METHODS } from "@/lib/validations/booking";
import { requireAdmin } from "@/server/auth";
import { listClientBookings } from "@/server/queries/bookings";
import { getClientForAdmin } from "@/server/queries/clients";

export const metadata: Metadata = { title: "Client" };

export default function ClientPage({ params }: PageProps<"/admin/clients/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Client params={params} />
    </Suspense>
  );
}

async function Client({ params }: Pick<PageProps<"/admin/clients/[id]">, "params">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const client = /^[0-9a-f-]{36}$/i.test(id) ? await getClientForAdmin(id) : null;
  if (!client) notFound();
  const bookings = await listClientBookings(client.id);
  const paid = bookings.reduce((sum, b) => sum + b.paidCents, 0);
  const contact =
    CONTACT_METHODS.find((c) => c.value === client.preferredContact)?.label ??
    client.preferredContact;
  const date = (iso: string) => format(new TZDate(iso, BUSINESS_TZ), "d MMM yyyy");

  return (
    <>
      <Button asChild variant="ghost" className="mb-2 -ml-3">
        <Link href="/admin/clients">
          <ArrowLeftIcon aria-hidden />
          Clients
        </Link>
      </Button>
      <PageHeader
        eyebrow={
          client.anonymised ? "personal data deleted" : `client since ${date(client.createdAt)}`
        }
        title={client.fullName}
        description={`${bookings.length} ${bookings.length === 1 ? "booking" : "bookings"} · ${formatPeso(paid)} paid`}
      />

      {!client.anonymised && (
        <section className="mb-8 grid gap-4 rounded-3xl border bg-card p-5 sm:grid-cols-2 sm:p-6">
          <div className="space-y-3">
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="flex items-center gap-2 font-semibold underline-offset-4 hover:underline"
              >
                <MailIcon className="size-4 text-muted-foreground" aria-hidden />
                {client.email}
              </a>
            )}
            <a
              href={`tel:${client.phone}`}
              className="flex items-center gap-2 font-semibold underline-offset-4 hover:underline"
            >
              <PhoneIcon className="size-4 text-muted-foreground" aria-hidden />
              {client.phone}
            </a>
            <p className="text-sm text-muted-foreground">Prefers: {contact}</p>
          </div>
          <div className="text-sm text-muted-foreground sm:text-right">
            <p>
              Agreed to the privacy notice on {date(client.consentGivenAt)}
              <span className="block">(version {client.consentVersion})</span>
            </p>
          </div>
        </section>
      )}

      <h2 className="mb-3 text-xl font-semibold">Booking history</h2>
      {bookings.length === 0 ? (
        <EmptyList title="No bookings" text="This client has no bookings left." />
      ) : (
        <BookingRows rows={bookings} />
      )}
      {admin.role === "owner" && !client.anonymised && (
        <AnonymiseClient id={client.id} name={client.fullName} />
      )}
    </>
  );
}
