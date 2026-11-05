import {
  bookingSummaryText,
  formatAddOns,
  formatBookingWhen,
  formatPerson,
  formatSummaryWhen,
  type BookingSummary,
} from "@/lib/booking/booking-summary";
import { WORKSHOP_REFUND_RULE } from "@/lib/booking/workshop";
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
  keepNote = false,
  note?: string,
) {
  const balance = Math.max(b.priceCents - b.paidCents, 0);
  const rows: [string, string][] = [
    ["Reference", b.reference],
    ["Package", b.serviceName],
    ...(b.people ?? []).map((p, i): [string, string] => [`Person ${i + 1}`, formatPerson(p)]),
    ...(b.addOns.length > 0 ? [["Add-ons", formatAddOns(b.addOns)!] as [string, string]] : []),
    ["When", formatSummaryWhen(b)],
    ...(b.location ? [["Location", b.location] as [string, string]] : []),
    ...(b.vatCents > 0 ? [["VAT included", formatPeso(b.vatCents)] as [string, string]] : []),
    ["Total", formatPeso(b.priceCents)],
    ["Paid", formatPeso(b.paidCents)],
    ["Balance", balance > 0 ? formatPeso(balance) : "Fully paid"],
  ];
  return frame(
    siteUrl,
    b.studioName,
    `<h1 style="margin:0 0 8px;font-size:22px">${esc(heading)}</h1>
<p style="margin:0 0 20px;line-height:1.5">Hi ${esc(b.contactName)}, ${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BLUSH};border-radius:12px">
${rows.map(([k, v]) => `<tr><td style="padding:8px 14px;font-size:13px;opacity:.75">${k}</td><td style="padding:8px 14px;font-weight:bold">${esc(v)}</td></tr>`).join("")}
</table>
${note ? `<p style="margin:16px 0 0;line-height:1.5;white-space:pre-line">${esc(note)}</p>` : ""}
${b.people ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5"><strong>Refunds:</strong> ${esc(WORKSHOP_REFUND_RULE)}</p>` : ""}
<p style="margin:24px 0 0"><a href="${esc(link.href)}" style="display:inline-block;background:${EVERGREEN};color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">${esc(link.label)}</a></p>
${keepNote ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.5"><strong>Keep this email.</strong> Your reference <strong>${esc(b.reference)}</strong> and this email address are all you need to look up your booking any time at ${esc(siteUrl)}/booking.</p>` : ""}
${questions(b.studioPhone, b.studioEmail)}`,
  );
}

const questions = (phone: string | null, email: string | null) =>
  phone || email
    ? `<p style="margin:24px 0 0;font-size:13px;opacity:.75">Questions? ${esc([phone, email].filter(Boolean).join(" · "))}</p>`
    : "";

/** The white card with the logo that every email sits in. */
function frame(siteUrl: string, studioName: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#FAF8F4;font-family:Helvetica,Arial,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td align="center" style="padding:20px 24px 16px;border-bottom:4px solid ${EVERGREEN}"><img src="${esc(siteUrl)}/brand/logo.jpg" width="112" height="112" alt="${esc(studioName)}" style="display:block;border:0;outline:none"></td></tr>
<tr><td style="padding:24px">
${body}
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
  note?: string,
): Content {
  const href = lookupUrl(siteUrl, b.reference);
  return {
    subject,
    html: layout(siteUrl, b, heading, intro, { href, label: "View your booking" }, true, note),
    text: `Hi ${b.contactName}, ${intro}\n\n${bookingSummaryText(b)}${note ? `\n\n${note}` : ""}\n\nView your booking: ${href}\n\nKeep this email: your reference ${b.reference} and this email address are all you need to look up your booking.`,
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

/** One line per booking in the "your bookings" reminder. */
export type BookingListItem = {
  reference: string;
  serviceName: string;
  startAt: string;
  endAt: string | null;
  statusLabel: string;
};

/**
 * "Email me my bookings": the bookings made with this email, so a client who lost
 * their reference can find it. Sent only to that address, never shown on screen.
 */
export function bookingListEmail(
  bookings: BookingListItem[],
  studio: { name: string; phone: string | null; email: string | null },
  siteUrl: string,
): Content {
  const one = bookings.length === 1;
  const intro = one
    ? "here is the booking made with this email. Tap the reference to open it."
    : "here are the bookings made with this email. Tap a reference to open it.";
  const footer = "You asked for this on our website. If it wasn't you, you can ignore this email.";
  const rows = bookings
    .map(
      (b) => `<tr><td style="padding:12px 14px;border-bottom:2px solid #fff">
<a href="${esc(lookupUrl(siteUrl, b.reference))}" style="font-weight:bold;font-size:16px;color:${EVERGREEN}">${esc(b.reference)}</a>
<div style="margin-top:2px">${esc(b.serviceName)} · ${esc(b.statusLabel)}</div>
<div style="font-size:13px;opacity:.75">${esc(formatBookingWhen(b.startAt, b.endAt))}</div>
</td></tr>`,
    )
    .join("");
  const list = bookings
    .map(
      (b) =>
        `${b.reference} · ${b.serviceName} · ${b.statusLabel}\n${formatBookingWhen(b.startAt, b.endAt)}\n${lookupUrl(siteUrl, b.reference)}`,
    )
    .join("\n\n");
  return {
    subject: `Your ${studio.name} booking reference${one ? "" : "s"}`,
    html: frame(
      siteUrl,
      studio.name,
      `<h1 style="margin:0 0 8px;font-size:22px">Your booking${one ? "" : "s"}</h1>
<p style="margin:0 0 20px;line-height:1.5">Hi, ${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BLUSH};border-radius:12px">${rows}</table>
<p style="margin:20px 0 0;font-size:13px;line-height:1.5">${esc(footer)}</p>
${questions(studio.phone, studio.email)}`,
    ),
    text: `Hi, ${intro}\n\n${list}\n\n${footer}`,
  };
}

/** A studio email about one booking, with a button to open it in admin. */
function studioEmail(
  b: BookingSummary,
  siteUrl: string,
  bookingId: string,
  subject: string,
  heading: string,
  intro: string,
  note?: string,
): Content {
  const href = `${siteUrl}/admin/bookings/${bookingId}`;
  return {
    subject,
    html: layout(
      siteUrl,
      { ...b, contactName: "there" },
      heading,
      intro,
      { href, label: "Open in admin" },
      false,
      note,
    ),
    text: `${intro}${note ? `\n\n${note}` : ""}\n\n${bookingSummaryText(b)}\n\nOpen in admin: ${href}`,
  };
}

/** After the client pays the rest of the price from their booking page. */
export const paymentReceivedEmail = (b: BookingSummary, siteUrl: string) =>
  clientEmail(
    b,
    siteUrl,
    `Payment received for ${b.reference}`,
    "Payment received",
    "thank you! We received your payment. Here are your booking details.",
  );

export const balancePaidAlertEmail = (b: BookingSummary, siteUrl: string, bookingId: string) =>
  studioEmail(
    b,
    siteUrl,
    bookingId,
    `Balance paid online: ${b.reference}`,
    "Balance paid",
    `${b.contactName} paid the rest of their booking online.`,
  );

/** To the studio when a client asks for a new date from their booking page. */
export const rescheduleRequestAlertEmail = (
  b: BookingSummary,
  siteUrl: string,
  bookingId: string,
  request: { preferred: string | null; message: string },
) =>
  studioEmail(
    b,
    siteUrl,
    bookingId,
    `Reschedule request: ${b.reference}`,
    "Reschedule request",
    `${b.contactName} asked to move their booking. Reply to them, then change the time in admin if it works.`,
    [request.preferred ? `Preferred: ${request.preferred}` : null, `Message: ${request.message}`]
      .filter(Boolean)
      .join("\n"),
  );

/**
 * The day before the shoot (sent by the daily reminders job). States only the
 * booking's facts: the balance appears only when there is one.
 */
export function shootReminderEmail(b: BookingSummary, siteUrl: string): Content {
  const balance = Math.max(b.priceCents - b.paidCents, 0);
  const note = [
    `Getting ready? Our tips: ${siteUrl}/prepare`,
    balance > 0 ? `Balance still to pay: ${formatPeso(balance)}.` : null,
    "Need to change something? Message us or reply to this email.",
  ]
    .filter(Boolean)
    .join("\n");
  return clientEmail(
    b,
    siteUrl,
    `See you tomorrow! ${b.serviceName} · ${b.reference}`,
    "See you tomorrow!",
    `just a friendly reminder that your ${b.people ? "workshop" : "session"} is tomorrow. We can't wait!`,
    note,
  );
}
