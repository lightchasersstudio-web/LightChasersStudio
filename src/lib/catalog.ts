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

export function categoryLabel(value: ServiceCategory): string {
  return SERVICE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
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
