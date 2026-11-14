import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BookingCharges } from "@/components/admin/bookings/booking-charges";
import { BookingRequests } from "@/components/admin/bookings/booking-requests";
import { BookingVat } from "@/components/admin/bookings/booking-vat";
import { ContactActions } from "@/components/admin/bookings/contact-actions";
import { DeleteBooking } from "@/components/admin/bookings/delete-booking";
import { PaymentReceipt } from "@/components/admin/bookings/payment-receipt";
import { PrintSheet } from "@/components/admin/bookings/print-sheet";
import { AdminNotesForm, RecordPaymentForm } from "@/components/admin/bookings/record-payment-form";
import { ShareBooking } from "@/components/admin/bookings/share-booking";
import { WorkshopAttendees } from "@/components/admin/bookings/workshop-attendees";
import { ReplyTemplates } from "@/components/admin/bookings/reply-templates";
import { RefundReviewBanner, StatusActions } from "@/components/admin/bookings/status-actions";
import { PageHeader } from "@/components/admin/page-header";
import { DetailSkeleton } from "@/components/admin/skeletons";
import { AgreedContract } from "@/components/booking/agreed-contract";
import { StatusBadge } from "@/components/booking/status-badge";
import { Button } from "@/components/ui/button";
import { formatAddOns, formatSummaryWhen } from "@/lib/booking/booking-summary";
import { describeHistoryEntry } from "@/lib/booking/history";
import {
  closedBookingNote,
  hoursUntil,
  pastRescheduleCutoff,
  RESCHEDULE_CUTOFF_HOURS,
  SHOOT_FLAGS,
  STUDIO_POLICY_TITLE,
} from "@/lib/booking/policy";
import { replyTemplates } from "@/lib/booking/reply-templates";
import { workshopRefundCents } from "@/lib/booking/workshop";
import { getPublicEnv } from "@/lib/env";
import { providerLabel } from "@/lib/payments/providers";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatPeso } from "@/lib/utils/money";
import { requireAdmin } from "@/server/auth";
import { getBookingForAdmin, listBookingHistory } from "@/server/queries/bookings";

export const metadata: Metadata = { title: "Booking" };

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
  const closedNote = closedBookingNote(
    {
      status: b.status,
      startAt: b.start_at,
      cancelledAt: b.cancelled_at,
      cancelReason: b.cancelReason,
      paidCents: b.paidCents,
    },
    "staff",
  );
  // Policy 1.4: moved once at most, up to 48 hours before the start.
  const rescheduleNote = !editable
    ? null
    : b.rescheduled_at
      ? "Already rescheduled once (the policy allows one). Only move it again for force majeure, without the fee."
      : pastRescheduleCutoff(b.start_at)
        ? `Less than ${RESCHEDULE_CUTOFF_HOURS} hours before the start: by policy it can't be rescheduled any more, except for force majeure.`
        : null;
  const flags = SHOOT_FLAGS.filter((f) => b[f.column]);
  // Charges and rescheduling fees: lines that aren't catalogue add-ons.
  const chargeLines = b.add_ons
    .filter((a) => a.add_on_id === null)
    .map((a) => ({ id: a.id, name: a.name, priceCents: a.price_cents }));
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
          description={`${b.serviceName} · ${formatSummaryWhen(b.summary)}`}
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
            <BookingRequests bookingId={b.id} requests={b.requests} editable={editable} />

            {active && (
              <section aria-labelledby="actions" className="space-y-3">
                <h2 id="actions" className="text-xl font-semibold">
                  Status
                </h2>
                <StatusActions
                  id={b.id}
                  status={b.status}
                  hasEmail={Boolean(b.email)}
                  policy={{
                    startAt: b.start_at,
                    paidCents: b.paidCents,
                    rescheduleFeeCents: b.service?.reschedule_fee_cents ?? 0,
                    started: hoursUntil(b.start_at) <= 0,
                  }}
                />
                {rescheduleNote && (
                  <p className="text-sm text-muted-foreground">{rescheduleNote}</p>
                )}
              </section>
            )}
            {closedNote && (
              <p
                role="note"
                className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground"
              >
                {closedNote}
              </p>
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
              <ReplyTemplates
                templates={replyTemplates(b.summary, lookupUrl)}
                initialId={b.status === "completed" ? "photos" : undefined}
              />
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
              {flags.length > 0 && (
                <ul className="space-y-1.5 rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">
                  {flags.map((f) => (
                    <li key={f.name}>{f.staff}</li>
                  ))}
                </ul>
              )}
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
              {b.service?.category === "workshop" && (
                <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">
                  <strong>Workshop</strong> · chose to pay{" "}
                  {b.deposit_cents >= b.price_cents ? "in full" : "half"}.{" "}
                  {workshopRefundCents(b.price_cents, b.paidCents) > 0
                    ? `If they can't attend, refund ${formatPeso(workshopRefundCents(b.price_cents, b.paidCents))} (half).`
                    : "No refund if they can't attend (not paid in full)."}
                </p>
              )}
              {b.attendees.length > 0 && <WorkshopAttendees attendees={b.attendees} />}
              {b.payments.length > 0 ? (
                <ul className="divide-y text-sm">
                  {b.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span className="flex flex-col">
                        <span>
                          {providerLabel(p.provider)}
                          {p.reference && (
                            <span className="text-muted-foreground"> · {p.reference}</span>
                          )}
                        </span>
                        {p.status === "paid" && p.receipt_number && (
                          <PaymentReceipt
                            paymentId={p.id}
                            number={p.receipt_number}
                            hasEmail={Boolean(b.email)}
                          />
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
              <BookingCharges
                bookingId={b.id}
                lines={chargeLines}
                prices={b.chargePrices}
                vatPercent={b.vat_cents > 0 ? b.vatPercent : 0}
                canAdd={["pending", "confirmed", "completed"].includes(b.status)}
              />
              {balance > 0 &&
                !["cancelled", "declined", "expired", "no_show"].includes(b.status) && (
                  <RecordPaymentForm bookingId={b.id} />
                )}
            </section>

            {b.contract_text && b.contract_accepted_at && (
              <AgreedContract
                text={b.contract_text}
                acceptedAt={b.contract_accepted_at}
                signedName={b.contract_signed_name}
                title={`${b.summary.serviceName} contract`}
              />
            )}
            {b.policy_text && b.policy_accepted_at && (
              <AgreedContract
                text={b.policy_text}
                acceptedAt={b.policy_accepted_at}
                title={STUDIO_POLICY_TITLE}
              />
            )}

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
