import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingLookup } from "@/components/booking/booking-lookup";
import { LookupFromParams } from "@/components/booking/lookup-from-params";
import { SectionHeading } from "@/components/public/section-heading";

export const metadata: Metadata = { title: "Payment not finished", robots: { index: false } };

/** PayMongo's cancel URL: the slot stays held until the hold expires. */
export default function PaymentCancelledPage({ searchParams }: PageProps<"/book/cancelled">) {
  return (
    <section className="bg-studio">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 md:py-16">
        <SectionHeading
          as="h1"
          eyebrow="no worries"
          title="Your payment wasn't finished"
          description="Your time is held for a short while. Enter your email to try paying again, or start a new booking if the hold has expired."
        />
        <div className="mt-8 rounded-[2rem] border bg-background p-5 sm:p-8">
          <Suspense fallback={<BookingLookup initialReference="" mode="pay" />}>
            <LookupFromParams searchParams={searchParams} mode="pay" />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
