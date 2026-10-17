import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import Image from "next/image";

import { formatBookingWhen } from "@/lib/booking/booking-summary";
import { STATUS_LABELS } from "@/lib/booking/status";
import { cn } from "@/lib/utils";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatPeso } from "@/lib/utils/money";
import type { AdminBooking } from "@/server/queries/bookings";

const PROVIDERS: Record<string, string> = { paymongo: "PayMongo", gcash: "GCash", cash: "Cash" };
const CONTACT: Record<string, string> = {
  email: "Email",
  phone: "Phone call",
  sms: "Text (SMS)",
  messenger: "Messenger",
  viber: "Viber",
};

/**
 * A one-page booking sheet to bring to the shoot. Hidden on screen; it's what
 * prints when the admin presses "Print sheet" (the rest of the page is hidden).
 */
export function PrintSheet({
  booking: b,
  className,
}: {
  booking: NonNullable<AdminBooking>;
  className?: string;
}) {
  const balance = Math.max(b.price_cents - b.paidCents, 0);
  const s = b.summary;
  return (
    <article className={cn("bg-white text-sm leading-relaxed text-black", className)}>
      <header className="flex items-center justify-between gap-6 border-b-2 border-black pb-4">
        <div className="flex items-center gap-4">
          <Image src="/brand/logo.jpg" alt="" width={64} height={64} sizes="64px" />
          <div>
            <p className="font-heading text-2xl font-semibold">{s.studioName}</p>
            <p>{[s.studioPhone, s.studioEmail].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs tracking-wider uppercase">Booking sheet</p>
          <p className="font-heading text-2xl font-semibold">{b.reference_code}</p>
          <p>{STATUS_LABELS[b.status]}</p>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-8">
        <Section title="Client">
          <Row label="Name" value={b.contact_name} />
          <Row label="Phone" value={b.contact_phone} />
          <Row label="Email" value={b.email} />
          <Row label="Messenger" value={b.messenger} />
          <Row label="Prefers" value={CONTACT[b.preferred_contact] ?? b.preferred_contact} />
        </Section>
        <Section title="Shoot">
          <Row label="Package" value={b.serviceName} />
          {s.addOns.length > 0 && (
            <Row label="Add-ons" value={s.addOns.map((a) => a.name).join(", ")} />
          )}
          <Row label="When" value={formatBookingWhen(b.start_at, b.end_at)} />
          <Row label="Location" value={b.location} />
          <Row label="People" value={String(b.participants)} />
        </Section>
      </div>

      <Section title="Client's requests" className="mt-6">
        <p className="whitespace-pre-line">{b.special_requests ?? "None"}</p>
      </Section>

      <Section title="Payment" className="mt-6">
        <table className="w-full border-collapse">
          <tbody>
            <tr className="border-b">
              <td className="py-1">{b.serviceName}</td>
              <td className="py-1 text-right">
                {formatPeso(
                  b.price_cents - s.vatCents - s.addOns.reduce((sum, a) => sum + a.priceCents, 0),
                )}
              </td>
            </tr>
            {s.addOns.map((a) => (
              <tr key={a.name} className="border-b">
                <td className="py-1">{a.name}</td>
                <td className="py-1 text-right">{formatPeso(a.priceCents)}</td>
              </tr>
            ))}
            {s.vatCents > 0 && (
              <tr className="border-b">
                <td className="py-1">VAT</td>
                <td className="py-1 text-right">{formatPeso(s.vatCents)}</td>
              </tr>
            )}
            <tr className="border-b font-semibold">
              <td className="py-1">Total</td>
              <td className="py-1 text-right">{formatPeso(b.price_cents)}</td>
            </tr>
            {b.payments
              .filter((p) => p.status === "paid")
              .map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-1">
                    Paid · {PROVIDERS[p.provider] ?? p.provider}
                    {p.paid_at && `, ${format(new TZDate(p.paid_at, BUSINESS_TZ), "d MMM yyyy")}`}
                  </td>
                  <td className="py-1 text-right">− {formatPeso(p.amount_cents)}</td>
                </tr>
              ))}
            <tr className="text-base font-bold">
              <td className="py-1">Balance to collect</td>
              <td className="py-1 text-right">
                {balance > 0 ? formatPeso(balance) : "Fully paid"}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {b.admin_notes && (
        <Section title="Studio notes" className="mt-6">
          <p className="whitespace-pre-line">{b.admin_notes}</p>
        </Section>
      )}

      <Section title="Notes on the day" className="mt-6">
        <div className="space-y-7 pt-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-b border-dashed border-black/40" />
          ))}
        </div>
      </Section>

      <p className="mt-8 text-xs text-black/60">
        Printed {format(TZDate.tz(BUSINESS_TZ), "d MMM yyyy, h:mm a")} · Contains personal data:
        keep it safe and dispose of it securely.
      </p>
    </article>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("break-inside-avoid", className)}>
      <h2 className="mb-2 border-b border-black/30 pb-1 text-xs font-bold tracking-wider uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <p className="grid grid-cols-[6rem_1fr] gap-2">
      <span className="text-black/60">{label}</span>
      <span className="font-semibold break-words">{value || "—"}</span>
    </p>
  );
}
