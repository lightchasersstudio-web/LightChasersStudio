import {
  bookingSummaryText,
  formatAddOns,
  formatBookingWhen,
  type BookingSummary,
} from "@/lib/booking/booking-summary";
import type { Email } from "@/lib/email/send";
import { formatPeso } from "@/lib/utils/money";

// Booking emails. Copy states only facts from the booking (no invented policies).
// Brand colours are inlined because email clients ignore stylesheets.

type Content = Omit<Email, "to">;

const INK = "#263332";
const EVERGREEN = "#455D5A";
const BLUSH = "#F8E6DF";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function layout(
  siteUrl: string,
  b: BookingSummary,
  heading: string,
  intro: string,
  link: { href: string; label: string },
) {
  const balance = Math.max(b.priceCents - b.paidCents, 0);
  const rows: [string, string][] = [
    ["Reference", b.reference],
    ["Package", b.serviceName],
    ...(b.addOns.length > 0 ? [["Add-ons", formatAddOns(b.addOns)!] as [string, string]] : []),
    ["When", formatBookingWhen(b.startAt, b.endAt)],
    ...(b.location ? [["Location", b.location] as [string, string]] : []),
    ...(b.vatCents > 0 ? [["VAT included", formatPeso(b.vatCents)] as [string, string]] : []),
    ["Total", formatPeso(b.priceCents)],
    ["Paid", formatPeso(b.paidCents)],
    ["Balance", balance > 0 ? formatPeso(balance) : "Fully paid"],
  ];
  return `<!doctype html><html><body style="margin:0;background:#FAF8F4;font-family:Helvetica,Arial,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td align="center" style="padding:20px 24px 16px;border-bottom:4px solid ${EVERGREEN}"><img src="${esc(siteUrl)}/brand/logo.jpg" width="112" height="112" alt="${esc(b.studioName)}" style="display:block;border:0;outline:none"></td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 8px;font-size:22px">${esc(heading)}</h1>
<p style="margin:0 0 20px;line-height:1.5">Hi ${esc(b.contactName)}, ${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BLUSH};border-radius:12px">
${rows.map(([k, v]) => `<tr><td style="padding:8px 14px;font-size:13px;opacity:.75">${k}</td><td style="padding:8px 14px;font-weight:bold">${esc(v)}</td></tr>`).join("")}
</table>
<p style="margin:24px 0 0"><a href="${esc(link.href)}" style="display:inline-block;background:${EVERGREEN};color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">${esc(link.label)}</a></p>
${b.studioPhone || b.studioEmail ? `<p style="margin:24px 0 0;font-size:13px;opacity:.75">Questions? ${esc([b.studioPhone, b.studioEmail].filter(Boolean).join(" · "))}</p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

const lookupUrl = (siteUrl: string, ref: string) =>
  `${siteUrl}/booking?ref=${encodeURIComponent(ref)}`;

function clientEmail(
  b: BookingSummary,
  siteUrl: string,
  subject: string,
  heading: string,
  intro: string,
): Content {
  const href = lookupUrl(siteUrl, b.reference);
  return {
    subject,
    html: layout(siteUrl, b, heading, intro, { href, label: "View your booking" }),
    text: `Hi ${b.contactName}, ${intro}\n\n${bookingSummaryText(b)}\n\nView your booking: ${href}`,
  };
}

/** After the deposit is paid (or straight away when no deposit is due). */
export const bookingReceivedEmail = (b: BookingSummary, siteUrl: string) =>
  clientEmail(
    b,
    siteUrl,
    `We received your booking ${b.reference}`,
    "Booking received",
    b.paidCents > 0
      ? "thank you! We received your booking and deposit. We'll confirm it soon."
      : "thank you! We received your booking request. We'll confirm it soon.",
  );

export const bookingConfirmedEmail = (b: BookingSummary, siteUrl: string) =>
  clientEmail(
    b,
    siteUrl,
    `Your booking ${b.reference} is confirmed`,
    "You're booked!",
    "your booking is confirmed. We can't wait to see you.",
  );

/** After staff change a booking (time, package, add-ons, price or details). */
export const bookingUpdatedEmail = (b: BookingSummary, siteUrl: string) =>
  clientEmail(
    b,
    siteUrl,
    `Your booking ${b.reference} was updated`,
    "Your booking was updated",
    "we've updated your booking. Here are the latest details.",
  );

export const bookingClosedEmail = (
  b: BookingSummary,
  siteUrl: string,
  status: "declined" | "cancelled",
) =>
  clientEmail(
    b,
    siteUrl,
    `Your booking ${b.reference} was ${status}`,
    `Booking ${status}`,
    `your booking has been ${status}. Please contact us if you have any questions.`,
  );

/** To the studio when a paid booking is waiting for review. */
export function newBookingAlertEmail(
  b: BookingSummary,
  siteUrl: string,
  bookingId: string,
  needsRefundReview: boolean,
): Content {
  const href = `${siteUrl}/admin/bookings/${bookingId}`;
  const intro = needsRefundReview
    ? "a PayMongo payment needs a check: the booking was cancelled or already paid, or its time had filled up. Please refund or rebook the client."
    : "a new booking is waiting for your review.";
  return {
    subject: `${needsRefundReview ? "Payment needs review" : "New booking needs review"}: ${b.reference}`,
    html: layout(siteUrl, { ...b, contactName: "there" }, "New booking", intro, {
      href,
      label: "Open in admin",
    }),
    text: `${intro}\n\n${bookingSummaryText(b)}\n\nOpen in admin: ${href}`,
  };
}
