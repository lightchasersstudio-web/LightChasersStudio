import "server-only";

import {
  balancePaidAlertEmail,
  bookingClosedEmail,
  bookingConfirmedEmail,
  bookingReceivedEmail,
  bookingUpdatedEmail,
  newBookingAlertEmail,
  paymentReceivedEmail,
  rescheduleRequestAlertEmail,
  shootReminderEmail,
  thankYouReviewEmail,
} from "@/lib/email/booking-emails";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { facebookReviewsUrl } from "@/lib/utils/social";
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

export async function notifyBookingUpdated(b: BookingRecord) {
  if (b.email) await sendEmail({ to: b.email, ...bookingUpdatedEmail(b.summary, siteUrl()) });
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

/** The client paid the rest online: thank them, tell the studio. */
export async function notifyBalancePaid(b: BookingRecord) {
  const jobs: Promise<void>[] = [];
  if (b.email) jobs.push(sendEmail({ to: b.email, ...paymentReceivedEmail(b.summary, siteUrl()) }));
  if (b.summary.studioEmail) {
    jobs.push(
      sendEmail({
        to: b.summary.studioEmail,
        ...balancePaidAlertEmail(b.summary, siteUrl(), b.id),
      }),
    );
  }
  await Promise.all(jobs);
}

/** A client asked for a new date: tell the studio (the request is also on the admin page). */
export async function notifyRescheduleRequest(
  b: BookingRecord,
  request: { preferred: string | null; message: string },
) {
  if (!b.summary.studioEmail) return;
  await sendEmail({
    to: b.summary.studioEmail,
    ...rescheduleRequestAlertEmail(b.summary, siteUrl(), b.id, request),
  });
}

/** "See you tomorrow!" (the daily reminders job). */
export async function sendShootReminder(b: BookingRecord) {
  if (b.email) await sendEmail({ to: b.email, ...shootReminderEmail(b.summary, siteUrl()) });
}

/** Marked completed: thank the client and ask for a Facebook review. */
export async function notifyBookingCompleted(b: BookingRecord) {
  if (!b.email) return;
  const { data } = await createAdminClient()
    .from("business_settings")
    .select("facebook_url")
    .single();
  await sendEmail({
    to: b.email,
    ...thankYouReviewEmail(b.summary, siteUrl(), facebookReviewsUrl(data?.facebook_url ?? null)),
  });
}
