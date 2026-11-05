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
        <span className="mx-auto grid size-20 animate-in place-items-center rounded-full bg-accent text-terracotta duration-500 fill-mode-both zoom-in-50">
          <PartyPopperIcon className="size-10" aria-hidden />
        </span>
        <p className="mt-5 font-script text-2xl text-terracotta-ink">yay, you&apos;re in!</p>
        <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">Thank you for booking</h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
          We&apos;ve got your booking and your time is held for you. Your booking details are on
          their way to your inbox.
        </p>
        <Suspense
          fallback={<Skeleton className="mx-auto mt-10 h-96 w-full max-w-md rounded-[1.75rem]" />}
        >
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
    // Opened without a (valid) reference: point to the lookup instead of a dead end.
    return (
      <div className="mx-auto mt-10 max-w-md rounded-3xl border bg-background p-6">
        <p className="text-muted-foreground">
          Your booking reference is in the email we sent you. Use it with your email to see your
          booking any time.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/booking">
              <SearchIcon aria-hidden />
              Find your booking
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }
  const settings = await getPublicSettings();
  return <BookingDone reference={reference} studioName={settings.business_name} />;
}
