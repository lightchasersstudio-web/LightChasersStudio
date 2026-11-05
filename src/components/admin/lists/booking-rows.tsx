import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/booking/status-badge";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatPeso } from "@/lib/utils/money";
import type { BookingRow } from "@/server/queries/bookings";

/**
 * Bookings as a list: stacked cards on phones, table-like columns from md up.
 * Each row opens the booking page.
 */
export function BookingRows({ rows }: { rows: BookingRow[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border bg-card">
      <div
        aria-hidden
        className="hidden grid-cols-[7.5rem_1fr_1fr_7rem_8rem_1rem] gap-4 border-b px-5 py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase md:grid"
      >
        <span>Shoot</span>
        <span>Client</span>
        <span>Package</span>
        <span className="text-right">Total</span>
        <span>Status</span>
        <span />
      </div>
      <ul className="divide-y">
        {rows.map((b) => {
          const when = new TZDate(b.startAt, BUSINESS_TZ);
          const balance = b.totalCents - b.paidCents;
          return (
            <li key={b.id}>
              <Link
                href={`/admin/bookings/${b.id}`}
                className="group grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-4 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:grid-cols-[7.5rem_1fr_1fr_7rem_8rem_1rem] md:items-center md:px-5"
              >
                <span className="col-span-2 text-sm text-muted-foreground md:col-span-1 md:text-foreground">
                  <span className="font-semibold">{format(when, "EEE d MMM yyyy")}</span>
                  <span className="md:block"> · {format(when, "h:mm a")}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{b.contactName}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {b.reference}
                  </span>
                </span>
                <span className="row-start-3 min-w-0 truncate text-sm md:row-start-auto">
                  {b.serviceName}
                </span>
                <span className="row-start-2 text-right md:row-start-auto">
                  <span className="block font-semibold tabular-nums">
                    {formatPeso(b.totalCents)}
                  </span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {b.paidCents === 0
                      ? "nothing paid"
                      : balance > 0
                        ? `${formatPeso(balance)} due`
                        : "paid in full"}
                  </span>
                </span>
                <span className="row-start-3 flex flex-col items-end gap-1 md:row-start-auto md:items-start">
                  <StatusBadge status={b.status} />
                  {b.needsRefundReview && (
                    <span className="text-xs font-semibold text-terracotta-ink">Check payment</span>
                  )}
                </span>
                <ArrowRightIcon
                  className="hidden size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 md:block"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
