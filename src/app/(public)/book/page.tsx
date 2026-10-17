import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BookingWizard } from "@/components/booking/booking-wizard";
import { SectionHeading } from "@/components/public/section-heading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicSettings, listActiveAddOns, listActiveServices } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Book now",
  description: "Pick a package, choose a free date and time, and hold it with a deposit.",
};

export default function BookPage({ searchParams }: PageProps<"/book">) {
  return (
    <section className="bg-studio">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <SectionHeading
          as="h1"
          eyebrow="let's make memories"
          title="Book your session"
          description="It takes about two minutes. Only free times are shown."
        />
        <div className="mt-10 rounded-[2rem] border bg-background p-5 shadow-sm sm:p-8">
          {/* searchParams (?service=slug) is request data, so it's read inside Suspense. */}
          <Suspense fallback={<WizardSkeleton />}>
            <Wizard searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

async function Wizard({ searchParams }: Pick<PageProps<"/book">, "searchParams">) {
  const [{ service: slug }, services, addOns, settings] = await Promise.all([
    searchParams,
    listActiveServices(),
    listActiveAddOns(),
    getPublicSettings(),
  ]);
  if (services.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-lg">Online booking opens soon. Message us and we&apos;ll set it up.</p>
        <Button asChild>
          <Link href="/contact">Contact us</Link>
        </Button>
      </div>
    );
  }
  const initial = services.find((s) => s.slug === (Array.isArray(slug) ? slug[0] : slug));
  return (
    // Keyed by the chosen package: Next keeps this page's client state between visits, and the
    // form only reads its starting values on mount, so a new "Book now" choice must remount it.
    <BookingWizard
      key={initial?.id ?? "none"}
      services={services.map(
        ({ id, slug, name, category, summary, price_cents, deposit_cents, duration_minutes }) => ({
          id,
          slug,
          name,
          category,
          summary,
          price_cents,
          deposit_cents,
          duration_minutes,
        }),
      )}
      addOns={addOns}
      initialServiceId={initial?.id ?? null}
      businessName={settings.business_name}
      depositPercent={settings.default_deposit_percent}
      vatPercent={settings.vat_percent}
      holdMinutes={settings.hold_minutes}
      maxAdvanceDays={settings.max_advance_days}
    />
  );
}

function WizardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-2/3" />
    </div>
  );
}
