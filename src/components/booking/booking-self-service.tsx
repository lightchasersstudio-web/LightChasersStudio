"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import {
  CalendarClockIcon,
  CheckIcon,
  Loader2Icon,
  MailIcon,
  MessageCircleHeartIcon,
  PhoneIcon,
  WalletIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { TextAreaField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatPeso } from "@/lib/utils/money";
import { rescheduleRequestSchema, type RescheduleRequestInput } from "@/lib/validations/booking";
import { payBalance, requestReschedule, type ClientBookingView } from "@/server/actions/booking";

export type StudioContact = {
  messengerHref: string | null;
  phone: string | null;
  email: string | null;
};

type Credentials = { reference: string; email: string };

const sentOn = (iso: string) => format(new TZDate(iso, BUSINESS_TZ), "EEE, d MMM 'at' h:mm a");

/**
 * What a client can do with their booking on /booking: pay the balance online,
 * message the studio about it, and ask for a new date (handled by the studio).
 */
export function BookingSelfService({
  booking,
  credentials,
  contact,
}: {
  booking: ClientBookingView;
  credentials: Credentials;
  contact: StudioContact;
}) {
  const [openRequest, setOpenRequest] = useState(booking.openRequest);
  const [asking, setAsking] = useState(false);
  const [paying, startPaying] = useTransition();
  const active = booking.status === "pending" || booking.status === "confirmed";
  const reference = booking.summary.reference;

  function pay() {
    startPaying(async () => {
      const result = await payBalance(credentials);
      if (handleResult(result, "")) window.location.assign(result.data.redirectUrl);
    });
  }

  return (
    <div className="space-y-4">
      {active && booking.balanceCents > 0 && (
        <section
          aria-labelledby="balance"
          className="flex flex-col gap-3 rounded-3xl border bg-card p-5 sm:flex-row sm:items-center"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-terracotta-ink">
            <WalletIcon className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 id="balance" className="font-semibold">
              Balance: {formatPeso(booking.balanceCents)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {booking.canPayBalance
                ? "Pay the rest now so it's all sorted before your shoot."
                : "Message us to arrange paying the rest."}
            </p>
          </div>
          {booking.canPayBalance && (
            <Button type="button" onClick={pay} disabled={paying} className="sm:shrink-0">
              {paying && <Loader2Icon className="animate-spin" aria-hidden />}
              Pay {formatPeso(booking.balanceCents)}
            </Button>
          )}
        </section>
      )}

      <section aria-labelledby="need-something" className="rounded-3xl border bg-card p-5">
        <h2 id="need-something" className="font-semibold">
          Need something?
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <MessageUs reference={reference} contact={contact} />
          {booking.canRequestChange && !openRequest && (
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start rounded-2xl py-3"
              aria-expanded={asking}
              onClick={() => setAsking((v) => !v)}
            >
              <CalendarClockIcon aria-hidden />
              Ask to reschedule
            </Button>
          )}
        </div>

        {openRequest && (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 rounded-2xl bg-sage/25 px-4 py-3 text-sm"
          >
            <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              You asked to reschedule on {sentOn(openRequest.createdAt)}
              {openRequest.preferred ? ` (preferred: ${openRequest.preferred})` : ""}. We&apos;ll
              get back to you. Your booking stays as it is until we confirm a new time.
            </span>
          </p>
        )}

        {asking && !openRequest && (
          <RescheduleForm
            credentials={credentials}
            onSent={(request) => {
              setOpenRequest(request);
              setAsking(false);
            }}
          />
        )}
      </section>
    </div>
  );
}

/** Messenger (with the reference typed in and copied), else a call or an email. */
function MessageUs({ reference, contact }: { reference: string; contact: StudioContact }) {
  const text = `Hi! I have a question about my booking ${reference}.`;
  const className = "h-auto justify-start rounded-2xl py-3";
  if (contact.messengerHref) {
    return (
      <Button asChild variant="outline" className={className}>
        <a
          href={`${contact.messengerHref}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            // In case Messenger doesn't fill the message in, the reference is ready to paste.
            navigator.clipboard?.writeText(reference).then(
              () => toast.success(`Reference ${reference} copied. Paste it in the chat.`),
              () => {},
            );
          }}
        >
          <MessageCircleHeartIcon aria-hidden />
          Message us about this booking
          <span className="sr-only"> (opens Messenger)</span>
        </a>
      </Button>
    );
  }
  if (contact.phone) {
    return (
      <Button asChild variant="outline" className={className}>
        <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>
          <PhoneIcon aria-hidden />
          Call us about this booking
        </a>
      </Button>
    );
  }
  if (contact.email) {
    const q = new URLSearchParams({ subject: `Booking ${reference}`, body: text });
    return (
      <Button asChild variant="outline" className={className}>
        <a href={`mailto:${contact.email}?${q.toString().replaceAll("+", "%20")}`}>
          <MailIcon aria-hidden />
          Email us about this booking
        </a>
      </Button>
    );
  }
  return null;
}

function RescheduleForm({
  credentials,
  onSent,
}: {
  credentials: Credentials;
  onSent: (request: { createdAt: string; preferred: string | null }) => void;
}) {
  const form = useForm<RescheduleRequestInput, unknown, z.output<typeof rescheduleRequestSchema>>({
    resolver: zodResolver(rescheduleRequestSchema),
    defaultValues: { ...credentials, preferred: "", message: "" },
  });

  async function onSubmit(values: z.output<typeof rescheduleRequestSchema>) {
    const result = await requestReschedule(values);
    if (handleResult(result, "Request sent. We'll get back to you soon.", form)) {
      onSent(result.data);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="mt-4 space-y-4 border-t pt-4"
    >
      <p className="text-sm text-muted-foreground">
        Tell us what works better. We&apos;ll check our calendar and get back to you; your booking
        stays as it is until we confirm a new time.
      </p>
      <FieldGroup>
        <TextField
          control={form.control}
          name="preferred"
          label="Dates or times that suit you (optional)"
          placeholder="e.g. any Saturday morning in December"
          maxLength={300}
        />
        <TextAreaField
          control={form.control}
          name="message"
          label="Message"
          rows={3}
          maxLength={1000}
          placeholder="Why you'd like to move it, or anything else we should know"
        />
      </FieldGroup>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
        Send request
      </Button>
    </form>
  );
}
