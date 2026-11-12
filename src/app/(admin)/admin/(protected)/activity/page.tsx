import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyList, Pager } from "@/components/admin/lists/pager";
import { PageHeader } from "@/components/admin/page-header";
import { ListSkeleton } from "@/components/admin/skeletons";
import { ACTIVITY_KINDS, activityHref, describeActivity } from "@/lib/admin/activity";
import { filtersHref, listFiltersSchema, parseFilters } from "@/lib/admin/list-filters";
import { cn } from "@/lib/utils";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { requireAdmin } from "@/server/auth";
import { listActivity } from "@/server/queries/activity";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  return (
    <>
      <PageHeader
        eyebrow="who did what"
        title="Activity"
        description="Every change made in the admin, newest first."
      />
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <Activity searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Activity({ searchParams }: Pick<PageProps<"/admin/activity">, "searchParams">) {
  await requireAdmin();
  const filters = parseFilters(listFiltersSchema, await searchParams);
  const kind = filters.kind in ACTIVITY_KINDS ? filters.kind : "";
  const { rows, total } = await listActivity({ ...filters, kind });
  const chips: [string, string][] = [
    ["", "Everything"],
    ...Object.entries(ACTIVITY_KINDS).map(([k, v]): [string, string] => [k, v.label]),
  ];

  return (
    <>
      <nav aria-label="Show" className="mb-5 flex flex-wrap gap-2">
        {chips.map(([value, label]) => (
          <Link
            key={value}
            href={filtersHref("/admin/activity", { kind: value, page: 1 })}
            aria-current={value === kind ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              value === kind
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyList title="Nothing here yet" text="Changes made in the admin will show here." />
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {rows.map((r) => {
              const href = activityHref(r.action, r.entity, r.entityId);
              const text = describeActivity(r.action, r.metadata, r.reference);
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                >
                  <time
                    dateTime={r.createdAt}
                    className="shrink-0 text-sm text-muted-foreground tabular-nums sm:w-44"
                  >
                    {format(new TZDate(r.createdAt, BUSINESS_TZ), "d MMM yyyy, h:mm a")}
                  </time>
                  <p className="min-w-0 flex-1">
                    {href ? (
                      <Link
                        href={href}
                        className="font-semibold underline-offset-4 hover:underline"
                      >
                        {text}
                      </Link>
                    ) : (
                      <span className="font-semibold">{text}</span>
                    )}
                  </p>
                  <p className="shrink-0 text-sm text-muted-foreground">by {r.actor}</p>
                </li>
              );
            })}
          </ul>
          <Pager
            page={filters.page}
            total={total}
            href={(page) => filtersHref("/admin/activity", { kind, page })}
          />
        </>
      )}
    </>
  );
}
