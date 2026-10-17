import { CalendarIcon, CameraIcon, CirclePlusIcon, MapPinIcon } from "lucide-react";
import Image from "next/image";

import { StatusBadge } from "@/components/booking/status-badge";
import { Sparkle } from "@/components/shared/sparkle";
import { formatBookingWhen, type BookingSummary } from "@/lib/booking/booking-summary";
import type { BookingStatus } from "@/lib/booking/status";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/utils/money";

/**
 * The booking at a glance, sized to screenshot on a phone and send over
 * Messenger. Used on the client's booking page and the admin booking page.
 */
export function BookingCard({
  summary: b,
  status,
  className,
}: {
  summary: BookingSummary;
  status: BookingStatus;
  className?: string;
}) {
  const balance = Math.max(b.priceCents - b.paidCents, 0);
  return (
    <article
      className={cn(
        "relative mx-auto w-full max-w-sm overflow-hidden rounded-[1.75rem] border bg-card shadow-lg",
        className,
      )}
      aria-label={`Booking ${b.reference}`}
    >
      <header className="relative bg-panel px-6 pt-6 pb-8 text-panel-foreground">
        <Sparkle className="absolute top-5 right-6 size-5 text-terracotta" />
        <span className="inline-block overflow-hidden rounded-full bg-white ring-2 ring-panel-foreground/20">
          <Image src="/brand/logo.jpg" alt={b.studioName} width={64} height={64} sizes="64px" />
        </span>
        <p className="mt-3 text-xs tracking-wider uppercase opacity-85">Booking reference</p>
        <p className="font-heading text-2xl font-semibold tracking-wide">{b.reference}</p>
      </header>
      <div className="-mt-4 space-y-4 rounded-t-[1.75rem] bg-card px-6 pt-5 pb-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">{b.contactName}</p>
          <StatusBadge status={status} />
        </div>
        <ul className="space-y-2.5 text-sm">
          <li className="flex gap-2.5">
            <CameraIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
            <span>{b.serviceName}</span>
          </li>
          {b.addOns.length > 0 && (
            <li className="flex gap-2.5">
              <CirclePlusIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
              <span>
                <span className="sr-only">Add-ons: </span>
                {b.addOns.map((a) => a.name).join(", ")}
              </span>
            </li>
          )}
          <li className="flex gap-2.5">
            <CalendarIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
            <span>{formatBookingWhen(b.startAt, b.endAt)}</span>
          </li>
          {b.location && (
            <li className="flex gap-2.5">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
              <span>{b.location}</span>
            </li>
          )}
        </ul>
        <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-accent p-3 text-center text-accent-foreground">
          <div>
            <dt className="text-xs opacity-80">Total</dt>
            <dd className="font-bold">{formatPeso(b.priceCents)}</dd>
          </div>
          <div>
            <dt className="text-xs opacity-80">Paid</dt>
            <dd className="font-bold">{formatPeso(b.paidCents)}</dd>
          </div>
          <div>
            <dt className="text-xs opacity-80">Balance</dt>
            <dd className="font-bold">{balance > 0 ? formatPeso(balance) : "Paid"}</dd>
          </div>
        </dl>
        {b.vatCents > 0 && (
          <p className="-mt-2 text-center text-xs text-muted-foreground">
            Total includes {formatPeso(b.vatCents)} VAT
          </p>
        )}
        {(b.studioPhone || b.studioEmail) && (
          <p className="text-center text-xs text-muted-foreground">
            {[b.studioPhone, b.studioEmail].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </article>
  );
}
