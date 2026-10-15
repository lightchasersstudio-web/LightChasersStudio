import type { Database } from "@/types/database.types";

export type BookingStatus = Database["public"]["Enums"]["booking_status"];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: "Waiting for payment",
  pending: "Needs review",
  confirmed: "Confirmed",
  completed: "Completed",
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
