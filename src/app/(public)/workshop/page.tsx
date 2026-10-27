import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { BookingWizard } from "@/components/booking/booking-wizard";
import { SectionHeading } from "@/components/public/section-heading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveWorkshop, getPublicSettings } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Workshop",
  description: "Sign up for our workshop: pick a free date and time, then pay half or in full.",
};

export default function WorkshopPage() {
  return (
    <section className="bg-studio">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <SectionHeading
          as="h1"
          eyebrow="learn with us"
          title="Workshop sign-up"
          description="Pick a free date and time, then pay half or the full price."
        />
        <div className="mt-10 rounded-[2rem] border bg-background p-5 shadow-sm sm:p-8">
          {/* The form shows today's calendar, so it renders per request (like /book). */}
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <Workshop />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

async function Workshop() {
  await connection();
  const [workshop, settings] = await Promise.all([getActiveWorkshop(), getPublicSettings()]);
  if (!workshop) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-lg">There&apos;s no workshop open for sign-up right now.</p>
        <Button asChild>
          <Link href="/contact">Contact us</Link>
        </Button>
      </div>
    );
  }
  return (
    <BookingWizard
      workshop
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
  );
}
