import type { Database } from "@/types/database.types";

export type ServiceCategory = Database["public"]["Enums"]["service_category"];

/**
 * Display labels for the `service_category` enum, in menu order. `comingSoon`
 * categories stay visible as "Coming soon" until they have an active package.
 */
export const SERVICE_CATEGORIES: { value: ServiceCategory; label: string; comingSoon?: true }[] = [
  { value: "wedding", label: "Weddings & prenup" },
  { value: "portrait", label: "Portraits & family" },
  { value: "studio", label: "Versa Space", comingSoon: true },
  { value: "event", label: "Events" },
  { value: "commercial", label: "Product & commercial" },
];

export const SERVICE_CATEGORY_VALUES = SERVICE_CATEGORIES.map((c) => c.value) as [
  ServiceCategory,
  ...ServiceCategory[],
];

/** Every package category, incl. the workshop (booked from its own button, never listed publicly). */
export const PACKAGE_CATEGORIES: typeof SERVICE_CATEGORIES = [
  ...SERVICE_CATEGORIES,
  { value: "workshop", label: "Workshop" },
];
export const PACKAGE_CATEGORY_VALUES = PACKAGE_CATEGORIES.map((c) => c.value) as [
  ServiceCategory,
  ...ServiceCategory[],
];

export function categoryLabel(value: ServiceCategory): string {
  return PACKAGE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/**
 * How a package is scheduled (`services.booking_category`, owner decision
 * 2026-11-06). The database enforces it (assert_schedule); this is the wording.
 */
export const BOOKING_CATEGORIES = [
  {
    value: "studio",
    label: "Studio",
    hint: "One studio session at a time, back to back.",
  },
  {
    value: "outside",
    label: "Outside event",
    hint: "One per day (weddings, prenups). Can run while a studio session is on.",
  },
  {
    value: "excluded",
    label: "No scheduling rules",
    hint: "Never blocks anything and is never blocked (e.g. the Photobooth).",
  },
] as const;
export type BookingCategory = (typeof BOOKING_CATEGORIES)[number]["value"];
export const BOOKING_CATEGORY_VALUES = BOOKING_CATEGORIES.map((c) => c.value) as [
  BookingCategory,
  ...BookingCategory[],
];

export function bookingCategoryLabel(value: string): string {
  return BOOKING_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** The database stores text; anything unexpected is treated as a studio booking. */
export function asBookingCategory(value: string | null | undefined): BookingCategory {
  return BOOKING_CATEGORY_VALUES.includes(value as BookingCategory)
    ? (value as BookingCategory)
    : "studio";
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Which down payment % a package uses (`services.deposit_group`, owner request
 * 2026-11-12): events = weddings, prenups and the Photobooth; the rest = studio.
 */
export const DEPOSIT_GROUPS = [
  { value: "studio", label: "Studio" },
  { value: "events", label: "Events" },
] as const;
export type DepositGroup = (typeof DEPOSIT_GROUPS)[number]["value"];
export const DEPOSIT_GROUP_VALUES = DEPOSIT_GROUPS.map((g) => g.value) as [
  DepositGroup,
  ...DepositGroup[],
];

export function asDepositGroup(value: string | null | undefined): DepositGroup {
  return value === "events" ? "events" : "studio";
}
