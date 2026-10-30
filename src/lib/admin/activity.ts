import { describeHistoryEntry } from "@/lib/booking/history";

type Meta = Record<string, unknown>;

/** Filter chips on the Activity page → the audit_logs entities they cover. */
export const ACTIVITY_KINDS = {
  booking: { label: "Bookings", entities: ["booking"] },
  client: { label: "Clients", entities: ["client"] },
  service: { label: "Packages & add-ons", entities: ["service", "add_on"] },
  portfolio: { label: "Portfolio & reviews", entities: ["portfolio_images", "review"] },
  settings: {
    label: "Hours & settings",
    entities: ["business_settings", "availability_rules", "blackout_dates"],
  },
} as const;
export type ActivityKind = keyof typeof ACTIVITY_KINDS;

const SIMPLE: Record<string, string> = {
  "booking.delete": "Deleted a booking",
  "booking.student_id_accepted": "Accepted a student ID",
  "booking.student_id_rejected": "Rejected a student ID",
  "client.anonymise": "Deleted a client's personal data",
  "service.create": "Added a package",
  "service.update": "Edited a package",
  "service.activate": "Turned a package on",
  "service.deactivate": "Turned a package off",
  "service.delete": "Deleted a package",
  "service.student_ids_deleted": "Deleted student ID photos",
  "add_on.create": "Added an add-on",
  "add_on.update": "Edited an add-on",
  "add_on.activate": "Turned an add-on on",
  "add_on.deactivate": "Turned an add-on off",
  "add_on.delete": "Deleted an add-on",
  "portfolio.add": "Added portfolio photos",
  "portfolio.delete": "Deleted a portfolio photo",
  "review.create": "Added a review",
  "review.update": "Edited a review",
  "review.publish": "Published a review",
  "review.hide": "Hid a review",
  "review.delete": "Deleted a review",
  "availability.update": "Changed the opening hours",
  "blackout.add": "Added days off",
  "blackout.remove": "Removed a day off",
  "settings.profile": "Updated the studio profile",
  "settings.booking_rules": "Changed the booking rules",
};

/** One line for the Activity page: what was done, plus the item's name when known. */
export function describeActivity(action: string, metadata: Meta, reference?: string): string {
  const base =
    SIMPLE[action] ??
    (action.startsWith("booking.") || action === "payment.record"
      ? describeHistoryEntry(action, metadata)
      : action);
  const name =
    typeof metadata.name === "string"
      ? metadata.name
      : (reference ?? (typeof metadata.reference === "string" ? metadata.reference : null));
  return name ? `${base} · ${name}` : base;
}

/** Where an entry's item lives in the admin, or null once it's gone. */
export function activityHref(
  action: string,
  entity: string,
  entityId: string | null,
): string | null {
  if (action.endsWith(".delete") || action === "client.anonymise") {
    return action === "client.anonymise" && entityId ? `/admin/clients/${entityId}` : null;
  }
  switch (entity) {
    case "booking":
      return entityId ? `/admin/bookings/${entityId}` : null;
    case "client":
      return entityId ? `/admin/clients/${entityId}` : null;
    case "service":
      return entityId ? `/admin/services/${entityId}` : "/admin/services";
    case "add_on":
      return "/admin/services";
    case "portfolio_images":
      return "/admin/portfolio";
    case "review":
      return "/admin/reviews";
    case "availability_rules":
    case "blackout_dates":
      return "/admin/availability";
    case "business_settings":
      return "/admin/settings";
    default:
      return null;
  }
}
