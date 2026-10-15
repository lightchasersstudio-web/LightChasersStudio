import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BlackoutManager } from "@/components/admin/blackout-manager";
import { PageHeader } from "@/components/admin/page-header";
import { FormSkeleton, ListSkeleton } from "@/components/admin/skeletons";
import { WeeklyHoursForm } from "@/components/admin/weekly-hours-form";
import { businessToday } from "@/lib/utils/business-date";
import { requireAdmin } from "@/server/auth";
import { listAvailabilityRules, listUpcomingBlackouts } from "@/server/queries/availability";

export const metadata: Metadata = { title: "Availability" };

export default function AvailabilityPage() {
  return (
    <>
      <PageHeader
        eyebrow="when you shoot"
        title="Availability"
        description="Clients can only pick times inside your opening hours, outside your days off and existing bookings."
      />

      <section aria-labelledby="hours-heading" className="space-y-4">
        <div>
          <h2 id="hours-heading" className="text-2xl font-semibold">
            Opening hours
          </h2>
          <p className="text-sm text-muted-foreground">
            Times are Philippine time. Split a day (e.g. a lunch break) with “Add hours”. Buffer
            time between sessions is in{" "}
            <Link
              href="/admin/settings#booking-rules"
              className="font-semibold text-terracotta-ink underline-offset-4 hover:underline"
            >
              Settings
            </Link>
            .
          </p>
        </div>
        <Suspense fallback={<ListSkeleton rows={7} />}>
          <WeeklyHours />
        </Suspense>
      </section>

      <section aria-labelledby="blackout-heading" className="mt-12 space-y-4">
        <div>
          <h2 id="blackout-heading" className="text-2xl font-semibold">
            Days off & holidays
          </h2>
          <p className="text-sm text-muted-foreground">No bookings can be made on these dates.</p>
        </div>
        <Suspense fallback={<FormSkeleton fields={2} />}>
          <Blackouts />
        </Suspense>
      </section>
    </>
  );
}

async function WeeklyHours() {
  await requireAdmin();
  return <WeeklyHoursForm rules={await listAvailabilityRules()} />;
}

async function Blackouts() {
  await requireAdmin();
  const today = businessToday();
  return <BlackoutManager blackouts={await listUpcomingBlackouts(today)} today={today} />;
}
