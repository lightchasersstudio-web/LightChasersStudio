"use client";

import { CopyIcon, Loader2Icon, PrinterIcon, SendIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { handleResult } from "@/components/admin/form-utils";
import { BookingCard } from "@/components/booking/booking-card";
import { Button } from "@/components/ui/button";
import { bookingSummaryText, type BookingSummary } from "@/lib/booking/booking-summary";
import type { BookingStatus } from "@/lib/booking/status";
import { resendBookingEmail } from "@/server/actions/admin-bookings";

/** The booking card to screenshot, plus copy-as-text, print and resend-email. */
export function ShareBooking({
  bookingId,
  summary,
  status,
  hasEmail,
}: {
  bookingId: string;
  summary: BookingSummary;
  status: BookingStatus;
  hasEmail: boolean;
}) {
  const [sending, startSending] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(bookingSummaryText(summary));
      toast.success("Booking details copied. Paste them into Messenger.");
    } catch {
      toast.error("Couldn't copy. Select the card text instead.");
    }
  }

  return (
    <div className="space-y-4">
      <BookingCard summary={summary} status={status} />
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" onClick={copy}>
          <CopyIcon aria-hidden />
          Copy as text
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <PrinterIcon aria-hidden />
          Print sheet
        </Button>
        {hasEmail && (
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={() =>
              startSending(async () => {
                handleResult(await resendBookingEmail({ id: bookingId }), "Email sent.");
              })
            }
          >
            {sending ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : (
              <SendIcon aria-hidden />
            )}
            Resend email
          </Button>
        )}
      </div>
    </div>
  );
}
