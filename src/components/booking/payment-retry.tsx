"use client";

import { CalendarPlusIcon, MessageCircleHeartIcon, TimerIcon, TimerOffIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useRememberedBooking } from "@/components/booking/add-to-calendar";
import { BookingLookup } from "@/components/booking/booking-lookup";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import { formatBookingWhen } from "@/lib/booking/booking-summary";
import { cn } from "@/lib/utils";

/** Milliseconds left until `until`, ticking every second (null before mount or if unknown). */
function useTimeLeft(until: string | null | undefined) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!until) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [until]);
  return until && now !== null ? Math.max(Date.parse(until) - now, 0) : null;
}

const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * /book/cancelled: the booking the client just left, how long its time is still
 * held, a one-tap retry (email remembered in this tab), and help if paying failed.
 */
export function PaymentRetry({
  reference,
  paymentMethods,
  qrCode,
}: {
  reference: string;
  /** e.g. "QR Ph (scan with GCash, Maya or any bank app)" */
  paymentMethods: string;
  /** QR Ph is offered: add the QR code tips. */
  qrCode: boolean;
}) {
  const booking = useRememberedBooking(reference);
  const left = useTimeLeft(booking?.holdExpiresAt);
  const ended = left === 0;
  const packageName = booking?.title.split(" · ")[0] ?? null;

  return (
    <div className="space-y-6">
      {reference && (
        <article
          aria-label={`Booking ${reference}`}
          className="overflow-hidden rounded-[1.75rem] border bg-card shadow-lg"
        >
          <header className="relative bg-panel px-6 pt-5 pb-7 text-panel-foreground">
            <Sparkle className="absolute top-5 right-6 size-5 text-terracotta" />
            <p className="text-xs font-bold tracking-wider uppercase opacity-85">
              Booking reference
            </p>
            <p className="font-heading text-2xl font-semibold tracking-wide whitespace-nowrap">
              {reference}
            </p>
          </header>
          <div className="-mt-4 space-y-4 rounded-t-[1.75rem] bg-card px-6 pt-5 pb-6">
            {booking && (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {packageName && (
                  <div>
                    <dt className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                      Package
                    </dt>
                    <dd className="font-semibold">{packageName}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    When
                  </dt>
                  <dd className="font-semibold">
                    {formatBookingWhen(booking.startAt, booking.endAt)}
                  </dd>
                </div>
              </dl>
            )}
            {left !== null && (
              <div
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3",
                  ended ? "bg-muted" : "bg-blush",
                )}
              >
                {ended ? (
                  <TimerOffIcon className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <TimerIcon className="size-6 shrink-0 text-terracotta-ink" aria-hidden />
                )}
                {ended ? (
                  <p className="text-sm">
                    <strong>Your hold has ended.</strong> The time may have gone to someone else, so
                    please book again.
                  </p>
                ) : (
                  <p className="text-sm">
                    Your time is held for{" "}
                    <strong
                      className="font-heading text-lg tabular-nums"
                      aria-live="off"
                      role="timer"
                    >
                      {mmss(left)}
                    </strong>{" "}
                    more. Pay before then to keep it.
                  </p>
                )}
              </div>
            )}
          </div>
        </article>
      )}

      <div className="rounded-[2rem] border bg-background p-5 sm:p-8">
        {ended ? (
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/book">
                <CalendarPlusIcon aria-hidden />
                Book again
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">
                <MessageCircleHeartIcon aria-hidden />
                Message us
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-xl font-semibold">Try paying again</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              {booking?.email
                ? "We've filled in your details. Tap the button to open the payment page again."
                : "Enter your reference and the email you booked with to open the payment page again."}
            </p>
            {/* The form reads its defaults once: remount when the remembered email loads. */}
            <BookingLookup
              key={booking?.email ?? ""}
              initialReference={reference}
              initialEmail={booking?.email ?? ""}
              mode="pay"
            />
          </>
        )}
      </div>

      <section
        aria-labelledby="pay-help"
        className="rounded-[2rem] border border-dashed bg-background/60 p-5 sm:p-8"
      >
        <h2 id="pay-help" className="text-lg font-semibold">
          Trouble paying?
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>You can pay with {paymentMethods}.</li>
          {qrCode && (
            <>
              <li>
                On a phone, save the QR code to your photos, then open it from your app&apos;s
                &ldquo;Scan&rdquo; screen.
              </li>
              <li>
                A QR code only works for a short time. If it stopped working, try paying again here
                for a fresh one.
              </li>
            </>
          )}
          <li>
            Still stuck?{" "}
            <Link
              href="/contact"
              className="font-semibold text-terracotta-ink underline-offset-4 hover:underline"
            >
              Message us
            </Link>
            {reference ? ` with your reference ${reference}` : ""} and we&apos;ll help you finish
            your booking.
          </li>
        </ul>
      </section>
    </div>
  );
}
