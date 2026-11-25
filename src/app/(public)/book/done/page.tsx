import { PartyPopperIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BookingDone } from "@/components/booking/booking-done";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { REFERENCE_RE } from "@/lib/booking/reference";
import { getPublicSettings } from "@/server/queries/public";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

/**
 * Where PayMongo sends the client after paying (and where deposit-free bookings
 * land). Never marks anything paid: only the verified webhook does that.
 */
export default function BookingDonePage({ searchParams }: PageProps<"/book/done">) {
  return (
    <section className="overflow-hidden bg-studio">
      <div className="relative mx-auto max-w-2xl px-4 py-14 text-center sm:px-6 md:py-20">
        <Sparkle className="absolute top-10 left-8 size-5 animate-twinkle text-terracotta" />
        <Sparkle className="absolute top-24 right-10 size-3.5 animate-twinkle text-sage [animation-delay:1.2s]" />
        <Suspense fallback={<DoneSkeleton />}>
          <Done searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  );
}

async function Done({ searchParams }: Pick<PageProps<"/book/done">, "searchParams">) {
  const { ref } = await searchParams;
  const reference = (Array.isArray(ref) ? ref[0] : ref)?.toUpperCase();
  if (!reference || !REFERENCE_RE.test(reference)) {
    // Opened without a (valid) reference, e.g. from history or a bookmark: nothing
    // was booked here, so no "thank you"; point to the lookup instead of a dead end.
    return (
      <>
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-accent text-terracotta">
          <SearchIcon className="size-9" aria-hidden />
        </span>
        <h1 className="mt-6 text-4xl font-semibold sm:text-5xl">Looking for your booking?</h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
          Your booking reference is in the email we sent you. Use it with your email to see your
          booking any time.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/booking">
              <SearchIcon aria-hidden />
              Find your booking
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/book">Book a session</Link>
          </Button>
        </div>
      </>
    );
  }
  const settings = await getPublicSettings();
  return (
    <>
      <span className="mx-auto grid size-20 animate-in place-items-center rounded-full bg-accent text-terracotta duration-500 fill-mode-both zoom-in-50">
        <PartyPopperIcon className="size-10" aria-hidden />
      </span>
      <p className="mt-5 font-script text-2xl text-terracotta-ink">yay, you&apos;re in!</p>
      <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">Thank you for booking</h1>
      <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
        We&apos;ve got your booking and your time is held for you. Your booking details are on their
        way to your inbox.
      </p>
      <BookingDone reference={reference} studioName={settings.business_name} />
    </>
  );
}

function DoneSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col items-center">
      <Skeleton className="size-20 rounded-full" />
      <Skeleton className="mt-6 h-12 w-80 max-w-full rounded-full" />
      <Skeleton className="mt-4 h-14 w-full max-w-lg rounded-2xl" />
      <Skeleton className="mt-10 h-96 w-full max-w-md rounded-[1.75rem]" />
    </div>
  );
}
