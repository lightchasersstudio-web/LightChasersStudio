import "server-only";

import {
  buildSalesMonths,
  reportEnd,
  reportStart,
  SALE_STATUSES,
  type PaymentRow,
  type SaleRow,
  type SalesMonth,
} from "@/lib/reports/sales";
import { createClient } from "@/lib/supabase/server";

const PAGE = 1000;

/** Reads every page of a query (PostgREST returns at most 1000 rows at a time). */
async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** The sales report's months, from real bookings and payments (RLS: admins only). */
export async function getSalesMonths(count = 24, now: Date = new Date()): Promise<SalesMonth[]> {
  const from = reportStart(count, now).toISOString();
  const to = reportEnd(now).toISOString();
  const supabase = await createClient();

  const [bookings, payments] = await Promise.all([
    allRows((a, b) =>
      supabase
        .from("bookings")
        .select("id, start_at, price_cents, service:services(category)")
        .in("status", [...SALE_STATUSES])
        .gte("start_at", from)
        .lt("start_at", to)
        .order("start_at")
        .order("id")
        .range(a, b),
    ),
    allRows((a, b) =>
      supabase
        .from("payments")
        .select("id, provider, amount_cents, paid_at")
        .eq("status", "paid")
        .gte("paid_at", from)
        .lt("paid_at", to)
        .order("paid_at")
        .order("id")
        .range(a, b),
    ),
  ]);

  const sales: SaleRow[] = bookings.map((b) => ({
    startAt: b.start_at,
    priceCents: b.price_cents,
    category: b.service?.category ?? null,
  }));
  const paid: PaymentRow[] = payments.flatMap((p) =>
    p.paid_at ? [{ paidAt: p.paid_at, amountCents: p.amount_cents, provider: p.provider }] : [],
  );
  return buildSalesMonths(sales, paid, count, now);
}
