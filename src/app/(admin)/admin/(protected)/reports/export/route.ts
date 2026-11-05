import { TZDate } from "@date-fns/tz";
import { addMonths, format } from "date-fns";

import { STATUS_LABELS } from "@/lib/booking/status";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { toCsv } from "@/lib/utils/csv";
import { assertAdmin } from "@/server/auth";

const pesos = (cents: number) => cents / 100;

/**
 * GET /admin/reports/export?month=YYYY-MM — one month of bookings (by session
 * date) with VAT, payments and balance, as a CSV for the accountant. Admins only.
 */
export async function GET(req: Request) {
  if (!(await assertAdmin())) return new Response("Not allowed", { status: 401 });
  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return new Response("Use ?month=YYYY-MM", { status: 400 });
  }
  const [y, m] = month.split("-").map(Number) as [number, number];
  const start = new TZDate(y, m - 1, 1, BUSINESS_TZ);
  const end = addMonths(start, 1);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "reference_code, status, source, start_at, contact_name, contact_phone, price_cents, vat_cents, service:services(name), add_ons:booking_add_ons(name, price_cents), client:clients(email), payments(provider, amount_cents, status)",
    )
    .gte("start_at", start.toISOString())
    .lt("start_at", end.toISOString())
    .order("start_at");
  if (error) {
    console.error("[export]", error);
    return new Response("Export failed", { status: 500 });
  }

  const rows = data.map((b) => {
    const paid = b.payments.filter((p) => p.status === "paid");
    const paidCents = paid.reduce((sum, p) => sum + p.amount_cents, 0);
    const when = new TZDate(b.start_at, BUSINESS_TZ);
    return [
      b.reference_code,
      format(when, "yyyy-MM-dd"),
      format(when, "h:mm a"),
      STATUS_LABELS[b.status],
      b.source === "admin" ? "Staff" : "Online",
      b.contact_name,
      b.contact_phone,
      b.client?.email ?? "",
      b.service?.name ?? "",
      b.add_ons.map((a) => `${a.name} (${pesos(a.price_cents)})`).join("; "),
      pesos(b.price_cents - b.vat_cents),
      pesos(b.vat_cents),
      pesos(b.price_cents),
      pesos(paidCents),
      pesos(b.price_cents - paidCents),
      [...new Set(paid.map((p) => p.provider))].join("; "),
    ];
  });

  const csv = toCsv(
    [
      "Reference",
      "Date",
      "Time",
      "Status",
      "Booked",
      "Client",
      "Phone",
      "Email",
      "Package",
      "Add-ons (PHP)",
      "Before VAT (PHP)",
      "VAT (PHP)",
      "Total (PHP)",
      "Paid (PHP)",
      "Balance (PHP)",
      "Paid by",
    ],
    rows,
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="light-chasers-bookings-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
