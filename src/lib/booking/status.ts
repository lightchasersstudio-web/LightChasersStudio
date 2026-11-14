import type { Database } from "@/types/database.types";

export type BookingStatus = Database["public"]["Enums"]["booking_status"];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: "Waiting for payment",
  pending: "Needs review",
  confirmed: "Confirmed",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
  declined: "Declined",
  expired: "Expired",
};

/** Statuses that hold a place on the calendar. */
export const ACTIVE_STATUSES: BookingStatus[] = [
  "pending_payment",
  "pending",
  "confirmed",
  "completed",
];

/** How a status reads to the client (emails); "Needs review" is the studio's view. */
export const CLIENT_STATUS_LABELS: Record<BookingStatus, string> = {
  ...STATUS_LABELS,
  pending: "Waiting for our confirmation",
};
