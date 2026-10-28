import { CalendarDaysIcon, ClockIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { BookingWizard } from "@/components/booking/booking-wizard";
import { SectionHeading } from "@/components/public/section-heading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatWorkshopWhen, workshopOpening } from "@/lib/booking/workshop";
import {
  getActiveWorkshop,
  getPublicSettings,
  getWorkshopSeatsTaken,
} from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Workshop",
  description: "Sign up for our photography workshop and pay half or the full price.",
};

const CLOSED = {
  no_date: {
    title: "The date is coming soon",
    text: "We're still setting the date for this workshop. Check back soon, or message us to hear first.",
  },
  started: {
    title: "Sign-ups have closed",
    text: "This workshop has already started. Message us to hear about the next one.",
  },
  full: {
    title: "Fully booked",
    text: "Every seat has been taken. Message us to join the waiting list or hear about the next one.",
  },
} as const;

export default function WorkshopPage() {
  return (
    <section className="bg-studio">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <SectionHeading
          as="h1"
          eyebrow="learn with us"
          title="Workshop sign-up"
          description="Save your seat, then pay half or the full price."
        />
        {/* Seats change with every sign-up, so this renders per request (like /book). */}
        <Suspense fallback={<Skeleton className="mt-10 h-96 w-full rounded-[2rem]" />}>
          <Workshop />
        </Suspense>
      </div>
    </section>
  );
}

async function Workshop() {
  await connection();
  const [workshop, settings] = await Promise.all([getActiveWorkshop(), getPublicSettings()]);
  if (!workshop) {
    return (
      <div className="mt-10 space-y-4 rounded-[2rem] border bg-background p-8 text-center shadow-sm">
        <p className="text-lg">There&apos;s no workshop open for sign-up right now.</p>
        <Button asChild>
          <Link href="/contact">Contact us</Link>
        </Button>
      </div>
    );
  }
  const opening = workshopOpening(workshop, await getWorkshopSeatsTaken(workshop.id));
  const when =
    workshop.workshop_starts_at && workshop.workshop_ends_at
      ? formatWorkshopWhen(workshop.workshop_starts_at, workshop.workshop_ends_at)
      : null;

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 rounded-3xl border bg-background p-5 shadow-sm sm:p-6">
        <p className="w-full font-heading text-xl font-semibold">{workshop.name}</p>
        <Detail Icon={CalendarDaysIcon} label="Date">
          {when?.date ?? "To be announced"}
        </Detail>
        {when && (
          <Detail Icon={ClockIcon} label="Time">
            {when.time}
          </Detail>
        )}
        {opening.open && opening.seatsLeft !== null && (
          <Detail Icon={UsersIcon} label="Seats">
            {opening.seatsLeft} {opening.seatsLeft === 1 ? "seat" : "seats"} left
          </Detail>
        )}
      </div>

      <div className="mt-6 rounded-[2rem] border bg-background p-5 shadow-sm sm:p-8">
        {opening.open && workshop.workshop_starts_at && workshop.workshop_ends_at ? (
          <BookingWizard
            workshop={{ startAt: workshop.workshop_starts_at, endAt: workshop.workshop_ends_at }}
            services={[
              {
                id: workshop.id,
                slug: workshop.slug,
                name: workshop.name,
                category: workshop.category,
                summary: workshop.summary,
                price_cents: workshop.price_cents,
                deposit_cents: workshop.deposit_cents,
                duration_minutes: workshop.duration_minutes,
              },
            ]}
            addOns={[]}
            initialServiceId={workshop.id}
            businessName={settings.business_name}
            depositPercent={settings.default_deposit_percent}
            vatPercent={settings.vat_percent}
            holdMinutes={settings.hold_minutes}
            maxAdvanceDays={settings.max_advance_days}
          />
        ) : (
          !opening.open && (
            <div className="space-y-3 py-6 text-center">
              <p className="font-heading text-2xl font-semibold">{CLOSED[opening.reason].title}</p>
              <p className="mx-auto max-w-md text-muted-foreground">
                {CLOSED[opening.reason].text}
              </p>
              <Button asChild className="mt-2">
                <Link href="/contact">Message us</Link>
              </Button>
            </div>
          )
        )}
      </div>
    </>
  );
}

function Detail({
  Icon,
  label,
  children,
}: {
  Icon: typeof CalendarDaysIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="font-semibold">{children}</span>
      </span>
    </p>
  );
}
