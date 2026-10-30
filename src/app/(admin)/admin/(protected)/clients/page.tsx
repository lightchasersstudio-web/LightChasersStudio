import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ArrowRightIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyList, Pager } from "@/components/admin/lists/pager";
import { PageHeader } from "@/components/admin/page-header";
import { ListSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filtersHref, listFiltersSchema, parseFilters } from "@/lib/admin/list-filters";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatPeso } from "@/lib/utils/money";
import { requireAdmin } from "@/server/auth";
import { listClients } from "@/server/queries/clients";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  return (
    <>
      <PageHeader
        eyebrow="the people we shoot for"
        title="Clients"
        description="Everyone who has booked, with their booking history."
      />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <Clients searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Clients({ searchParams }: Pick<PageProps<"/admin/clients">, "searchParams">) {
  await requireAdmin();
  const filters = parseFilters(listFiltersSchema, await searchParams);
  const { rows, total } = await listClients(filters);

  return (
    <>
      <form
        action="/admin/clients"
        className="mb-5 flex flex-col gap-3 rounded-3xl border bg-card p-4 sm:flex-row sm:items-end"
      >
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Name, email or phone"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1 sm:flex-none">
            <SearchIcon aria-hidden />
            Search
          </Button>
          {filters.q && (
            <Button asChild variant="ghost">
              <Link href="/admin/clients">Clear</Link>
            </Button>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyList
          title={filters.q ? "No clients match" : "No clients yet"}
          text={
            filters.q
              ? "Try part of their name, email or phone number."
              : "Clients appear here after their first booking."
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            {total} {total === 1 ? "client" : "clients"}
            {filters.q ? " found" : ""}
          </p>
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/clients/${c.id}`}
                  className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-4 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:grid-cols-[1fr_10rem_7rem_1rem] sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.fullName}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[c.email, c.phone].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-right text-sm text-muted-foreground sm:text-left">
                    {c.bookingCount} {c.bookingCount === 1 ? "booking" : "bookings"}
                    {c.lastShootAt && (
                      <span className="block">
                        last {format(new TZDate(c.lastShootAt, BUSINESS_TZ), "d MMM yyyy")}
                      </span>
                    )}
                  </span>
                  <span className="col-span-2 text-sm font-semibold tabular-nums sm:col-span-1 sm:text-right">
                    {formatPeso(c.paidCents)}
                    <span className="font-normal text-muted-foreground sm:block"> paid</span>
                  </span>
                  <ArrowRightIcon
                    className="hidden size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
          <Pager
            page={filters.page}
            total={total}
            href={(page) => filtersHref("/admin/clients", { q: filters.q, page })}
          />
        </>
      )}
    </>
  );
}
