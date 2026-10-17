import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatPeso } from "@/lib/utils/money";

type Meta = Record<string, unknown>;

const SIMPLE: Record<string, string> = {
  "booking.create": "Booked the client in",
  "booking.confirmed": "Confirmed the booking",
  "booking.declined": "Declined the booking",
  "booking.completed": "Marked the booking completed",
  "booking.cancelled": "Cancelled the booking",
  "booking.notes": "Updated the private notes",
  "booking.email_resent": "Resent the client email",
  "booking.refund_reviewed": "Marked the late payment as reviewed",
  "booking.vat_add": "Added VAT",
  "booking.vat_remove": "Removed VAT",
};
const PROVIDERS: Record<string, string> = { gcash: "GCash", cash: "cash", paymongo: "PayMongo" };

/** One line for the booking History panel, from an audit_logs action + metadata. */
export function describeHistoryEntry(action: string, metadata: Meta): string {
  if (SIMPLE[action]) return SIMPLE[action];
  if (action === "payment.record") {
    const provider = PROVIDERS[String(metadata.provider)] ?? "a";
    return `Recorded a ${provider} payment of ${formatPeso(Number(metadata.amount_cents ?? 0))}`;
  }
  if (action === "booking.update") {
    const before = (metadata.before ?? {}) as Meta;
    const after = (metadata.after ?? {}) as Meta;
    const parts: string[] = [];
    if (after.start_at && after.start_at !== before.start_at) {
      parts.push(
        `moved to ${format(new TZDate(String(after.start_at), BUSINESS_TZ), "EEE, d MMM yyyy, h:mm a")}`,
      );
    }
    if (after.service_id && after.service_id !== before.service_id) parts.push("package changed");
    if (typeof after.price_cents === "number" && after.price_cents !== before.price_cents) {
      parts.push(
        `total ${formatPeso(Number(before.price_cents ?? 0))} → ${formatPeso(after.price_cents)}`,
      );
    }
    const names = (list: unknown) =>
      JSON.stringify(((list ?? []) as Meta[]).map((a) => [a.name, a.price_cents]));
    if (names(after.add_ons) !== names(before.add_ons)) parts.push("add-ons changed");
    if (parts.length === 0) parts.push("details updated");
    if (metadata.emailed_client) parts.push("client emailed");
    return `Edited the booking: ${parts.join(", ")}`;
  }
  return action;
}
