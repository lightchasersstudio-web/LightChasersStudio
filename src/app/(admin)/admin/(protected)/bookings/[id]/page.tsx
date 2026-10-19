import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BookingVat } from "@/components/admin/bookings/booking-vat";
import { ContactActions } from "@/components/admin/bookings/contact-actions";
import { DeleteBooking } from "@/components/admin/bookings/delete-booking";
import { PrintSheet } from "@/components/admin/bookings/print-sheet";
import { AdminNotesForm, RecordPaymentForm } from "@/components/admin/bookings/record-payment-form";
import { ShareBooking } from "@/components/admin/bookings/share-booking";
import { ReplyTemplates } from "@/components/admin/bookings/reply-templates";
import { RefundReviewBanner, StatusActions } from "@/components/admin/bookings/status-actions";
import { PageHeader } from "@/components/admin/page-header";
import { DetailSkeleton } from "@/components/admin/skeletons";
import { StatusBadge } from "@/components/booking/status-badge";
import { Button } from "@/components/ui/button";
import { formatAddOns, formatBookingWhen } from "@/lib/booking/booking-summary";
import { describeHistoryEntry } from "@/lib/booking/history";
import { replyTemplates } from "@/lib/booking/reply-templates";
import { getPublicEnv } from "@/lib/env";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatPeso } from "@/lib/utils/money";
import { requireAdmin } from "@/server/auth";
import { getBookingForAdmin, listBookingHistory } from "@/server/queries/bookings";

export const metadata: Metadata = { title: "Booking" };

const PROVIDERS: Record<string, string> = { paymongo: "PayMongo", gcash: "GCash", cash: "Cash" };

export default function BookingPage({ params }: PageProps<"/admin/bookings/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Booking params={params} />
    </Suspense>
  );
}

async function Booking({ params }: Pick<PageProps<"/admin/bookings/[id]">, "params">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const b = /^[0-9a-f-]{36}$/i.test(id) ? await getBookingForAdmin(id) : null;
  if (!b) notFound();
  const history = await listBookingHistory(b.id);
  const editable = ["pending", "confirmed"].includes(b.status);
  const balance = Math.max(b.price_cents - b.paidCents, 0);
  const active = ["pending_payment", "pending", "confirmed"].includes(b.status);
  const day = format(new TZDate(b.start_at, BUSINESS_TZ), "yyyy-MM-dd");
  const lookupUrl = `${getPublicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/booking?ref=${b.reference_code}`;

  return (
    <>
      <PrintSheet booking={b} className="hidden print:block" />
      {/* Everything on screen; printing shows only the sheet above. */}
      <div className="print:hidden">
        <Button asChild variant="ghost" className="mb-2 -ml-3">
          <Link href={`/admin/calendar?month=${day.slice(0, 7)}&day=${day}`}>
            <ArrowLeftIcon aria-hidden />
            Calendar
          </Link>
        </Button>
        <PageHeader
          eyebrow={b.source === "admin" ? "booked by staff" : "booked online"}
          title={b.contact_name}
          description={`${b.serviceName} · ${formatBookingWhen(b.start_at, b.summary.endAt)}`}
          actions={
            <>
              <StatusBadge status={b.status} className="px-3 py-1 text-sm" />
              {editable && (
                <Button asChild variant="outline">
                  <Link href={`/admin/bookings/${b.id}/edit`}>
                    <PencilIcon aria-hidden />
                    Edit booking
                  </Link>
                </Button>
              )}
            </>
          }
        />

        <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-8">
            {b.needs_refund_review && <RefundReviewBanner id={b.id} />}

            {active && (
              <section aria-labelledby="actions" className="space-y-3">
                <h2 id="actions" className="text-xl font-semibold">
                  Status
                </h2>
                <StatusActions id={b.id} status={b.status} hasEmail={Boolean(b.email)} />
              </section>
            )}

            <section aria-labelledby="contact" className="space-y-3 rounded-3xl border bg-card p-5">
              <h2 id="contact" className="text-xl font-semibold">
                Contact
              </h2>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{b.contact_phone}</dd>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{b.email ?? "—"}</dd>
                {b.messenger && (
                  <>
                    <dt className="text-muted-foreground">Messenger</dt>
                    <dd className="break-all">{b.messenger}</dd>
                  </>
                )}
              </dl>
              <ContactActions
                phone={b.contact_phone}
                email={b.email}
                messenger={b.messenger}
                preferred={b.preferred_contact}
                reference={b.reference_code}
              />
            </section>

            <section aria-labelledby="replies" className="space-y-3 rounded-3xl border bg-card p-5">
              <div>
                <h2 id="replies" className="text-xl font-semibold">
                  Quick replies
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ready-made messages filled in from this booking, to paste into Messenger or a
                  text.
                </p>
              </div>
              <ReplyTemplates templates={replyTemplates(b.summary, lookupUrl)} />
            </section>

            <section aria-labelledby="shoot" className="space-y-3 rounded-3xl border bg-card p-5">
              <h2 id="shoot" className="text-xl font-semibold">
                Shoot
              </h2>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="font-semibold">{b.reference_code}</dd>
                {b.summary.addOns.length > 0 && (
                  <>
                    <dt className="text-muted-foreground">Add-ons</dt>
                    <dd>{formatAddOns(b.summary.addOns)}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Location</dt>
                <dd>{b.location ?? "—"}</dd>
                <dt className="text-muted-foreground">People</dt>
                <dd>{b.participants}</dd>
                <dt className="text-muted-foreground">Requests</dt>
                <dd className="whitespace-pre-line">{b.special_requests ?? "—"}</dd>
              </dl>
            </section>

            <section
              aria-labelledby="payments"
              className="space-y-4 rounded-3xl border bg-card p-5"
            >
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 id="payments" className="text-xl font-semibold">
                  Payments
                </h2>
                <p className="text-sm">
                  Paid <strong>{formatPeso(b.paidCents)}</strong> of {formatPeso(b.price_cents)} ·{" "}
                  {balance > 0 ? (
                    <>
                      Balance <strong>{formatPeso(balance)}</strong>
                    </>
                  ) : (
                    <strong>Fully paid</strong>
                  )}
                </p>
              </div>
              {b.payments.length > 0 ? (
                <ul className="divide-y text-sm">
                  {b.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>
                        {PROVIDERS[p.provider] ?? p.provider}
                        {p.reference && (
                          <span className="text-muted-foreground"> · {p.reference}</span>
                        )}
                      </span>
                      <span>
                        <strong>{formatPeso(p.amount_cents)}</strong>{" "}
                        <span className="text-muted-foreground">
                          {p.status === "paid" && p.paid_at
                            ? format(new TZDate(p.paid_at, BUSINESS_TZ), "d MMM, h:mm a")
                            : p.status}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              )}
              <BookingVat
                // Remount after a change so the switch shows the saved state.
                key={b.vat_cents}
                bookingId={b.id}
                vatCents={b.vat_cents}
                beforeVatCents={b.price_cents - b.vat_cents}
                vatPercent={b.vatPercent}
                disabled={["cancelled", "declined", "expired"].includes(b.status)}
              />
              {balance > 0 && b.status !== "cancelled" && b.status !== "declined" && (
                <RecordPaymentForm bookingId={b.id} />
              )}
            </section>

            <section aria-labelledby="notes" className="rounded-3xl border bg-card p-5">
              <h2 id="notes" className="sr-only">
                Notes
              </h2>
              <AdminNotesForm id={b.id} notes={b.admin_notes} />
            </section>

            <section aria-labelledby="history" className="space-y-3 rounded-3xl border bg-card p-5">
              <h2 id="history" className="text-xl font-semibold">
                History
              </h2>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
              ) : (
                <ol className="space-y-2.5 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                      <span>{describeHistoryEntry(h.action, h.metadata)}</span>
                      <span className="text-muted-foreground">
                        {h.actor} ·{" "}
                        {format(new TZDate(h.createdAt, BUSINESS_TZ), "d MMM yyyy, h:mm a")}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {admin.role === "owner" && <DeleteBooking id={b.id} reference={b.reference_code} />}
          </div>

          <aside aria-label="Share booking" className="lg:sticky lg:top-6 lg:self-start">
            <ShareBooking
              bookingId={b.id}
              summary={b.summary}
              status={b.status}
              hasEmail={Boolean(b.email)}
            />
          </aside>
        </div>
      </div>
    </>
  );
}
