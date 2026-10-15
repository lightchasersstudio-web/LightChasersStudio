import "server-only";

import {
  bookingClosedEmail,
  bookingConfirmedEmail,
  bookingReceivedEmail,
  newBookingAlertEmail,
} from "@/lib/email/booking-emails";
import { sendEmail } from "@/lib/email/send";
import { getPublicEnv } from "@/lib/env";
import type { BookingRecord } from "@/server/queries/booking-record";

// Who gets which email. Bookings without a client email (staff-made) skip the
// client emails; the studio alert goes to the email in Settings.

const siteUrl = () => getPublicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

/** New paid (or deposit-free) online booking: thank the client, alert the studio. */
export async function notifyBookingReceived(b: BookingRecord) {
  const jobs: Promise<void>[] = [];
  if (b.email) jobs.push(sendEmail({ to: b.email, ...bookingReceivedEmail(b.summary, siteUrl()) }));
  if (b.summary.studioEmail) {
    jobs.push(
      sendEmail({
        to: b.summary.studioEmail,
        ...newBookingAlertEmail(b.summary, siteUrl(), b.id, b.needsRefundReview),
      }),
    );
  }
  await Promise.all(jobs);
}

export async function notifyBookingConfirmed(b: BookingRecord) {
  if (b.email) await sendEmail({ to: b.email, ...bookingConfirmedEmail(b.summary, siteUrl()) });
}

export async function notifyBookingClosed(b: BookingRecord, status: "declined" | "cancelled") {
  if (b.email) {
    await sendEmail({ to: b.email, ...bookingClosedEmail(b.summary, siteUrl(), status) });
  }
}

/** The client email that matches the booking's current status (for "Resend email"). */
export async function resendLatestEmail(b: BookingRecord) {
  if (b.status === "confirmed" || b.status === "completed") return notifyBookingConfirmed(b);
  if (b.status === "declined" || b.status === "cancelled") return notifyBookingClosed(b, b.status);
  if (b.email) await sendEmail({ to: b.email, ...bookingReceivedEmail(b.summary, siteUrl()) });
}
