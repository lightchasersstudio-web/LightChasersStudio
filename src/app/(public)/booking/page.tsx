import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingLookup } from "@/components/booking/booking-lookup";
import { LookupFromParams } from "@/components/booking/lookup-from-params";
import { SectionHeading } from "@/components/public/section-heading";

export const metadata: Metadata = {
  title: "Your booking",
  description: "Look up your booking with its reference and your email.",
  robots: { index: false },
};

export default function BookingLookupPage({ searchParams }: PageProps<"/booking">) {
  return (
    <section className="bg-studio">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 md:py-16">
        <SectionHeading
          as="h1"
          eyebrow="your booking"
          title="Find your booking"
          description="Enter the reference from your confirmation email and the email you booked with."
        />
        <div className="mt-8 rounded-[2rem] border bg-background p-5 sm:p-8">
          <Suspense fallback={<BookingLookup initialReference="" mode="view" />}>
            <LookupFromParams searchParams={searchParams} mode="view" />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
