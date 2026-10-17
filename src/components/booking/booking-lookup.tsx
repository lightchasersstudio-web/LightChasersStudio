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
import { BookingCard } from "@/components/booking/booking-card";
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
  mode,
}: {
  initialReference: string;
  mode: "view" | "pay";
}) {
  const [booking, setBooking] = useState<ClientBookingView | null>(null);
  const form = useForm<LookupInput, unknown, z.output<typeof lookupSchema>>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { reference: initialReference, email: "" },
  });

  async function onSubmit(values: z.output<typeof lookupSchema>) {
    if (mode === "pay") {
      const result = await resumePayment(values);
      if (handleResult(result, "", form)) window.location.assign(result.data.redirectUrl);
      return;
    }
    const result = await lookupBooking(values);
    if (handleResult(result, "", form)) setBooking(result.data);
  }

  if (booking) {
    return (
      <div className="space-y-5">
        <BookingCard summary={booking.summary} status={booking.status} />
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
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
        {mode === "pay" ? "Try paying again" : "Find my booking"}
      </Button>
    </form>
  );
}
