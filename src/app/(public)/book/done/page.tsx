import { PartyPopperIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AddToCalendarFromSession } from "@/components/booking/add-to-calendar";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

/**
 * Where PayMongo sends the client after paying. Never marks anything paid:
 * only the verified webhook does that.
 */
export default function BookingDonePage({ searchParams }: PageProps<"/book/done">) {
  return (
    <section className="bg-studio">
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6 md:py-24">
        <PartyPopperIcon className="mx-auto size-12 text-terracotta" aria-hidden />
        <h1 className="mt-4 text-4xl font-semibold">Thank you!</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          We&apos;re confirming your payment. You&apos;ll get an email with your booking details
          shortly, and we&apos;ll be in touch to confirm your session.
        </p>
        <Suspense fallback={null}>
          <Reference searchParams={searchParams} />
        </Suspense>
        <Button asChild variant="outline" className="mt-8">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </section>
  );
}

async function Reference({ searchParams }: Pick<PageProps<"/book/done">, "searchParams">) {
  const { ref } = await searchParams;
  const reference = Array.isArray(ref) ? ref[0] : ref;
  if (!reference || !/^BK-\d{4}-[0-9A-F]{6}$/.test(reference)) return null;
  return (
    <div className="mt-8 rounded-3xl border bg-background p-6">
      <p className="text-sm text-muted-foreground">Your booking reference</p>
      <p className="font-heading text-3xl font-semibold tracking-wide">{reference}</p>
      <AddToCalendarFromSession reference={reference} />
      <Button asChild variant="link" className="mt-2">
        <Link href={`/booking?ref=${reference}`}>View your booking</Link>
      </Button>
    </div>
  );
}
