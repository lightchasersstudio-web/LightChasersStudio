import { PlusIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BookingRows } from "@/components/admin/lists/booking-rows";
import { EmptyList, Pager } from "@/components/admin/lists/pager";
import { PageHeader } from "@/components/admin/page-header";
import { ListSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { bookingFiltersSchema, filtersHref, parseFilters } from "@/lib/admin/list-filters";
import { STATUS_LABELS } from "@/lib/booking/status";
import { requireAdmin } from "@/server/auth";
import { listBookings } from "@/server/queries/bookings";
import { listServicesForAdmin } from "@/server/queries/services";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  return (
    <>
      <PageHeader
        eyebrow="every session, in one place"
        title="Bookings"
        description="Search and filter all bookings, past and upcoming."
        actions={
          <Button asChild>
            <Link href="/admin/bookings/new">
              <PlusIcon aria-hidden />
              New booking
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<ListSkeleton rows={6} />}>
        <Bookings searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Bookings({ searchParams }: Pick<PageProps<"/admin/bookings">, "searchParams">) {
  await requireAdmin();
  const filters = parseFilters(bookingFiltersSchema, await searchParams);
  const [{ rows, total }, services] = await Promise.all([
    listBookings(filters),
    listServicesForAdmin(),
  ]);
  const filtered = Boolean(
    filters.q || filters.status || filters.service || filters.from || filters.to,
  );

  return (
    <>
      {/* A plain GET form: filters live in the URL, so a filtered list can be bookmarked or shared. */}
      <form
        action="/admin/bookings"
        className="mb-5 grid gap-3 rounded-3xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto_auto_auto] lg:items-end"
      >
        <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Name, email, phone or reference"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="status">Status</Label>
          <NativeSelect id="status" name="status" defaultValue={filters.status} className="w-full">
            <NativeSelectOption value="">Any status</NativeSelectOption>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="service">Package</Label>
          <NativeSelect
            id="service"
            name="service"
            defaultValue={filters.service}
            className="w-full"
          >
            <NativeSelectOption value="">Any package</NativeSelectOption>
            {services.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="from">Shoot from</Label>
          <Input id="from" name="from" type="date" defaultValue={filters.from} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">to</Label>
          <Input id="to" name="to" type="date" defaultValue={filters.to} />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" className="flex-1 lg:flex-none">
            <SearchIcon aria-hidden />
            Search
          </Button>
          {filtered && (
            <Button asChild variant="ghost">
              <Link href="/admin/bookings">Clear</Link>
            </Button>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyList
          title={filtered ? "No bookings match" : "No bookings yet"}
          text={
            filtered
              ? "Try a shorter search or fewer filters."
              : "Bookings from the website and the ones you add will show here."
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            {total} {total === 1 ? "booking" : "bookings"}
            {filtered ? " found" : ""}
          </p>
          <BookingRows rows={rows} />
          <Pager
            page={filters.page}
            total={total}
            href={(page) => filtersHref("/admin/bookings", { ...filters, page })}
          />
        </>
      )}
    </>
  );
}
