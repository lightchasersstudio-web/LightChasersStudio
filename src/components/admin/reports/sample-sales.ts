import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

import type { ServiceCategory } from "@/lib/catalog";
import { BUSINESS_TZ } from "@/lib/utils/business-date";

// SAMPLE DATA ONLY. The sales report is front end only for now: these numbers
// are made up (but stable, so they don't jump around on reload). When the
// backend is ready, replace `sampleSalesMonths()` with a query that returns
// the same `SalesMonth[]` shape and nothing else needs to change.

export type PaymentMethod = "gcash" | "cash" | "card";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "gcash", label: "GCash" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
];

export type SalesMonth = {
  /** "2026-10" */
  month: string;
  /** "Oct" / "Oct 2026" */
  label: string;
  longLabel: string;
  bookings: number;
  salesCents: number;
  byCategory: Partial<Record<ServiceCategory, { bookings: number; salesCents: number }>>;
  byMethod: Record<PaymentMethod, number>;
};

// Typical package value per category, in centavos.
const AVG_CENTS: Partial<Record<ServiceCategory, number>> = {
  wedding: 32_000_00,
  portrait: 4_200_00,
  event: 15_000_00,
  commercial: 8_000_00,
};

// Rough Zamboanga seasonality, Jan..Dec (weddings peak Dec–May, events in December).
const SEASON = [1.15, 1.05, 0.95, 1.1, 1.2, 0.85, 0.75, 0.8, 0.85, 0.95, 1.05, 1.35];

/** Stable pseudo-random 0..1 from a number. */
function noise(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** The last `count` months up to and including this month (studio time), oldest first. */
export function sampleSalesMonths(count = 24, now: Date = new Date()): SalesMonth[] {
  const today = new TZDate(now, BUSINESS_TZ);
  return Array.from({ length: count }, (_, i) => {
    const d = new TZDate(today.getFullYear(), today.getMonth() - (count - 1 - i), 1, BUSINESS_TZ);
    const seed = d.getFullYear() * 12 + d.getMonth();
    const growth = 0.8 + (i / count) * 0.35; // the studio is growing
    const season = SEASON[d.getMonth()]!;
    // This month is only partly over.
    const partial = i === count - 1 ? Math.max(today.getDate() / 30, 0.2) : 1;

    const counts: Partial<Record<ServiceCategory, number>> = {
      wedding: Math.round((1.5 + noise(seed) * 2) * season * growth * partial),
      portrait: Math.round((6 + noise(seed + 1) * 6) * season * growth * partial),
      event: Math.round((1 + noise(seed + 2) * 3) * season * growth * partial),
      commercial: Math.round((1 + noise(seed + 3) * 2.5) * growth * partial),
    };
    const byCategory: SalesMonth["byCategory"] = {};
    let bookings = 0;
    let salesCents = 0;
    for (const [cat, n] of Object.entries(counts) as [ServiceCategory, number][]) {
      const cents = Math.round((n * AVG_CENTS[cat]! * (0.85 + noise(seed + n) * 0.3)) / 100) * 100;
      byCategory[cat] = { bookings: n, salesCents: cents };
      bookings += n;
      salesCents += cents;
    }
    const pesos = (cents: number) => Math.round(cents / 100) * 100;
    const gcash = pesos(salesCents * (0.55 + noise(seed + 7) * 0.1));
    const card = pesos(salesCents * (0.1 + noise(seed + 8) * 0.06));

    return {
      month: format(d, "yyyy-MM"),
      label: format(d, "MMM"),
      longLabel: format(d, "MMMM yyyy"),
      bookings,
      salesCents,
      byCategory,
      byMethod: { gcash, card, cash: salesCents - gcash - card },
    };
  });
}
