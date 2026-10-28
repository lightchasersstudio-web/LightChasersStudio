"use client";

import { CalendarIcon, CameraIcon, ChevronDownIcon, CirclePlusIcon } from "lucide-react";

import type { WizardService } from "@/components/booking/booking-wizard";
import { Sparkle } from "@/components/shared/sparkle";
import { formatBookingWhen } from "@/lib/booking/booking-summary";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils/format";
import { formatPeso } from "@/lib/utils/money";
import type { PublicAddOn } from "@/server/queries/public";

type Props = {
  service: WizardService | null;
  addOns: PublicAddOn[];
  startAt: string | null;
  endAt: string | null;
  vat: number;
  vatPercent: number;
  total: number;
  deposit: number;
  /** Current wizard step: rows for finished steps get a "Change" link. */
  step: number;
  onGoTo?: (step: number) => void;
  /** The step that picks the package (workshops: the payment step). */
  packageStep: number;
  /** The step that picks the date and time; null when it's fixed (workshops). */
  whenStep: number | null;
  /** Replaces the package price line (workshops: "3 people · ₱13,000"). */
  priceText: string | null;
  className?: string;
};

/**
 * What the client has picked so far, beside the wizard on wide screens and as a
 * tap-to-open bar on phones, so they never lose track of the price.
 */
export function BookingSummaryPanel(props: Props) {
  const { service, total, className } = props;
  return (
    <aside aria-label="Your booking so far" className={className}>
      {/* Phones: a compact bar, once there's something to show. */}
      {service && (
        <details className="group rounded-2xl border bg-card lg:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground">Your booking · </span>
              {formatPeso(total)}
            </span>
            <ChevronDownIcon
              className="size-4 shrink-0 transition-transform duration-300 group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="border-t px-4 pt-3 pb-4">
            <Rows {...props} />
          </div>
        </details>
      )}

      {/* Wide screens: a card that stays in view while scrolling the calendar. */}
      <div className="sticky top-24 hidden rounded-3xl border bg-card p-5 shadow-sm lg:block">
        <p className="flex items-center gap-1.5 font-script text-xl text-terracotta-ink">
          <Sparkle className="size-3 text-terracotta" />
          your booking
        </p>
        {service ? (
          <div className="mt-3">
            <Rows {...props} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Pick a package and your total shows up here.
          </p>
        )}
      </div>
    </aside>
  );
}

function Rows({
  service,
  addOns,
  startAt,
  endAt,
  vat,
  vatPercent,
  total,
  deposit,
  step,
  onGoTo,
  packageStep,
  whenStep,
  priceText,
}: Props) {
  if (!service) return null;
  const change = (to: number, label: string) =>
    onGoTo && step > to ? (
      <button
        type="button"
        onClick={() => onGoTo(to)}
        className="shrink-0 text-xs font-semibold text-terracotta-ink underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
      >
        Change<span className="sr-only"> {label}</span>
      </button>
    ) : null;

  return (
    <div className="space-y-4 text-sm">
      <ul className="space-y-3">
        <li className="flex gap-2.5">
          <CameraIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{service.name}</span>
            <span className="text-muted-foreground">
              {service.duration_minutes !== null &&
                `${formatDuration(service.duration_minutes)} · `}
              {priceText ?? formatPeso(service.price_cents)}
            </span>
          </span>
          {change(packageStep, "package")}
        </li>
        {addOns.length > 0 && (
          <li className="flex gap-2.5">
            <CirclePlusIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
            <ul className="min-w-0 flex-1 space-y-0.5">
              {addOns.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span>{a.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    + {formatPeso(a.price_cents)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        )}
        <li className="flex gap-2.5">
          <CalendarIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
          <span className={cn("min-w-0 flex-1", !startAt && "text-muted-foreground")}>
            {startAt ? formatBookingWhen(startAt, endAt) : "Date and time not picked yet"}
          </span>
          {startAt && whenStep !== null && change(whenStep, "date and time")}
        </li>
      </ul>
      <dl className="space-y-1 rounded-2xl bg-accent p-3 text-accent-foreground">
        {vat > 0 && (
          <div className="flex justify-between gap-3 text-xs">
            <dt>VAT ({vatPercent}%)</dt>
            <dd>+ {formatPeso(vat)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt>Total</dt>
          <dd className="font-bold">{formatPeso(total)}</dd>
        </div>
        {deposit > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <dt>{deposit >= total ? "Pay now" : "Deposit now"}</dt>
            <dd className="font-heading text-lg font-semibold">{formatPeso(deposit)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
