import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

import type { ServiceCategory } from "@/lib/catalog";
import { BUSINESS_TZ } from "@/lib/utils/business-date";

// The sales report's numbers, built from bookings and payments:
// * sales and bookings count each booking once, in the month of its shoot (like
//   the CSV export), at its total including add-ons and VAT. Only bookings that
//   are going ahead count: deposit paid, confirmed or done.
// * "how clients paid" is money actually received, in the month it was paid.

export type PaymentMethod = "gcash" | "cash" | "online";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "online", label: "Online (PayMongo)" },
  { value: "gcash", label: "GCash (sent to you)" },
  { value: "cash", label: "Cash" },
];

/** Booking statuses that count as a sale. */
export const SALE_STATUSES = ["pending", "confirmed", "completed"] as const;

export type SalesMonth = {
  /** "2026-10" */
  month: string;
  /** "Oct" */
  label: string;
  /** "October 2026" */
  longLabel: string;
  bookings: number;
  salesCents: number;
  byCategory: Partial<Record<ServiceCategory, { bookings: number; salesCents: number }>>;
  /** Money received this month, by how it was paid. */
  byMethod: Record<PaymentMethod, number>;
};

export type SaleRow = { startAt: string; priceCents: number; category: ServiceCategory | null };
export type PaymentRow = { paidAt: string; amountCents: number; provider: string };

/** The first instant of the oldest month in the report (studio time). */
export function reportStart(count: number, now: Date): Date {
  const today = new TZDate(now, BUSINESS_TZ);
  return new Date(
    new TZDate(today.getFullYear(), today.getMonth() - (count - 1), 1, BUSINESS_TZ).getTime(),
  );
}

/** The first instant after the report's last month (the current one). */
export function reportEnd(now: Date): Date {
  const today = new TZDate(now, BUSINESS_TZ);
  return new Date(new TZDate(today.getFullYear(), today.getMonth() + 1, 1, BUSINESS_TZ).getTime());
}

function methodOf(provider: string): PaymentMethod {
  if (provider === "gcash" || provider === "cash") return provider;
  return "online";
}

/** `count` months up to and including this one (studio time), oldest first. */
export function buildSalesMonths(
  sales: SaleRow[],
  payments: PaymentRow[],
  count: number,
  now: Date = new Date(),
): SalesMonth[] {
  const start = new TZDate(reportStart(count, now), BUSINESS_TZ);
  const months = Array.from({ length: count }, (_, i): SalesMonth => {
    const d = new TZDate(start.getFullYear(), start.getMonth() + i, 1, BUSINESS_TZ);
    return {
      month: format(d, "yyyy-MM"),
      label: format(d, "MMM"),
      longLabel: format(d, "MMMM yyyy"),
      bookings: 0,
      salesCents: 0,
      byCategory: {},
      byMethod: { gcash: 0, cash: 0, online: 0 },
    };
  });
  const byKey = new Map(months.map((m) => [m.month, m]));
  const monthOf = (iso: string) => byKey.get(format(new TZDate(iso, BUSINESS_TZ), "yyyy-MM"));

  for (const s of sales) {
    const m = monthOf(s.startAt);
    if (!m) continue;
    m.bookings += 1;
    m.salesCents += s.priceCents;
    if (s.category) {
      const c = (m.byCategory[s.category] ??= { bookings: 0, salesCents: 0 });
      c.bookings += 1;
      c.salesCents += s.priceCents;
    }
  }
  for (const p of payments) {
    const m = monthOf(p.paidAt);
    if (m) m.byMethod[methodOf(p.provider)] += p.amountCents;
  }
  return months;
}
