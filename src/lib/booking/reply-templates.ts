import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

import { formatBookingWhen, type BookingSummary } from "@/lib/booking/booking-summary";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatPeso } from "@/lib/utils/money";

export type ReplyTemplate = { id: string; label: string; text: string };

/**
 * Ready-to-paste Messenger replies filled in from the booking. They state only
 * facts from the booking; anything the studio must add is in [brackets].
 */
export function replyTemplates(b: BookingSummary, lookupUrl: string): ReplyTemplate[] {
  const first = b.contactName.trim().split(/\s+/)[0] ?? b.contactName;
  const when = formatBookingWhen(b.startAt, b.endAt);
  const day = format(new TZDate(b.startAt, BUSINESS_TZ), "EEEE, d MMMM");
  const time = format(new TZDate(b.startAt, BUSINESS_TZ), "h:mm a");
  const balance = Math.max(b.priceCents - b.paidCents, 0);
  const balanceLine =
    balance > 0 ? `Remaining balance: ${formatPeso(balance)}.` : "You're fully paid. Thank you!";
  const where = b.location ? ` at ${b.location}` : "";
  const sign = `– ${b.studioName}`;

  const templates: ReplyTemplate[] = [
    {
      id: "confirmed",
      label: "Booking confirmed",
      text: [
        `Hi ${first}! Your ${b.serviceName} is confirmed for ${when}${where}.`,
        `Reference: ${b.reference}`,
        balanceLine,
        `You can view your booking anytime here: ${lookupUrl}`,
        `See you soon! ${sign}`,
      ].join("\n"),
    },
    {
      id: "reminder",
      label: "Shoot reminder",
      text: [
        `Hi ${first}! Just a friendly reminder of your ${b.serviceName} on ${day} at ${time}${where}.`,
        balance > 0 ? `Remaining balance: ${formatPeso(balance)}.` : null,
        `Message us here if anything changes. We're excited to see you! ${sign}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  if (balance > 0) {
    templates.push({
      id: "balance",
      label: "Balance reminder",
      text: [
        `Hi ${first}! A quick note on your ${b.serviceName} (${b.reference}) on ${day}.`,
        `Paid so far: ${formatPeso(b.paidCents)} of ${formatPeso(b.priceCents)}. Remaining balance: ${formatPeso(balance)}.`,
        `[How to pay the balance]`,
        `Thank you! ${sign}`,
      ].join("\n"),
    });
  }

  templates.push(
    {
      id: "photos",
      label: "Photos are ready",
      text: [
        `Hi ${first}! Your photos from your ${b.serviceName} are ready!`,
        `[Paste the link to your photos here]`,
        `We hope you love them. ${sign}`,
      ].join("\n"),
    },
    {
      id: "thanks",
      label: "Thank you + review",
      text: [
        `Hi ${first}! Thank you so much for choosing ${b.studioName} for your ${b.serviceName}.`,
        `If you enjoyed it, we'd love a few words about your experience. With your permission, we may share it on our website.`,
        `Thank you! ${sign}`,
      ].join("\n"),
    },
  );

  return templates;
}
