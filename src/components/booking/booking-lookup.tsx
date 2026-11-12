"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { AddToCalendar } from "@/components/booking/add-to-calendar";
import { AgreedContract } from "@/components/booking/agreed-contract";
import { BookingCard } from "@/components/booking/booking-card";
import { BookingCountdown } from "@/components/booking/booking-countdown";
import { BookingSelfService, type StudioContact } from "@/components/booking/booking-self-service";
import { saveBookingOnDevice, useSavedBookings } from "@/components/booking/saved-bookings";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { manilaTime } from "@/lib/utils/business-date";
import { lookupSchema, type LookupInput } from "@/lib/validations/booking";
import { lookupBooking, resumePayment, type ClientBookingView } from "@/server/actions/booking";

/**
 * Reference + email form. "view" shows the client's booking card (/booking);
 * "pay" restarts the PayMongo checkout while the hold lasts (/book/cancelled).
 */
export function BookingLookup({
  initialReference,
  initialEmail = "",
  mode,
  contact,
  justPaid = false,
}: {
  initialReference: string;
  initialEmail?: string;
  mode: "view" | "pay";
  /** How the client can reach the studio from their booking ("view" mode). */
  contact?: StudioContact;
  /** Back from paying the balance: the payment may take a moment to show. */
  justPaid?: boolean;
}) {
  const [booking, setBooking] = useState<ClientBookingView | null>(null);
  const [credentials, setCredentials] = useState<{ reference: string; email: string } | null>(null);
  const saved = useSavedBookings();
  const form = useForm<LookupInput, unknown, z.output<typeof lookupSchema>>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { reference: initialReference, email: initialEmail },
  });

  async function onSubmit(values: z.output<typeof lookupSchema>) {
    if (mode === "pay") {
      const result = await resumePayment(values);
      if (handleResult(result, "", form)) window.location.assign(result.data.redirectUrl);
      return;
    }
    const result = await lookupBooking(values);
    if (handleResult(result, "", form)) {
      setBooking(result.data);
      setCredentials({ reference: values.reference, email: values.email });
      saveBookingOnDevice({
        reference: result.data.summary.reference,
        title: result.data.summary.serviceName,
        startAt: result.data.summary.startAt,
      });
    }
  }

  if (booking) {
    return (
      <div className="space-y-5">
        {justPaid && booking.balanceCents > 0 && (
          <p role="status" className="rounded-2xl bg-sage/25 px-4 py-3 text-sm">
            Thanks for paying! It can take a minute to show here. You&apos;ll also get an email once
            it&apos;s through.
          </p>
        )}
        <BookingCard summary={booking.summary} status={booking.status} />
        <BookingCountdown booking={booking} />
        {booking.status === "pending_payment" && booking.holdExpiresAt && (
          <p className="text-center text-sm text-muted-foreground">
            Your time is held until {manilaTime(booking.holdExpiresAt)} while the deposit is paid.
          </p>
        )}
        {(booking.status === "pending" || booking.status === "confirmed") && (
          <AddToCalendar
            event={{
              reference: booking.summary.reference,
              title: `${booking.summary.serviceName} · ${booking.summary.studioName}`,
              startAt: booking.summary.startAt,
              endAt: booking.summary.endAt,
              location: booking.summary.location,
            }}
          />
        )}
        {contact && credentials && (
          <BookingSelfService booking={booking} credentials={credentials} contact={contact} />
        )}
        {booking.contract && (
          <AgreedContract
            text={booking.contract.text}
            acceptedAt={booking.contract.acceptedAt}
            signedName={booking.contract.signedName}
            title="The contract you agreed to"
          />
        )}
        <p className="text-center text-sm text-muted-foreground">
          Tip: screenshot this card to keep it handy.{" "}
          <Link
            href="/prepare"
            className="font-semibold text-terracotta-ink underline-offset-4 hover:underline"
          >
            How to prepare for your shoot
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FieldGroup>
        <TextField
          control={form.control}
          name="reference"
          label="Booking reference"
          placeholder="BK-2026-1A2B3C"
          autoComplete="off"
        />
        <TextField
          control={form.control}
          name="email"
          label="Email you booked with"
          type="email"
          autoComplete="email"
        />
      </FieldGroup>
      {!initialReference && saved.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Booked on this device</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {saved.map((b) => (
              <Button
                key={b.reference}
                type="button"
                variant="outline"
                size="sm"
                className="font-heading tracking-wide"
                onClick={() => form.setValue("reference", b.reference, { shouldValidate: true })}
              >
                {b.reference}
              </Button>
            ))}
          </div>
        </div>
      )}
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
        {mode === "pay" ? "Try paying again" : "Find my booking"}
      </Button>
    </form>
  );
}
