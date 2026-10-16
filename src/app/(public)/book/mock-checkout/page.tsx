import { FlaskConicalIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MockCheckoutForm } from "@/components/booking/mock-checkout-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeso } from "@/lib/utils/money";
import { getMockCheckout } from "@/server/queries/mock-checkout";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false } };

/** Trial mode only: stands in for PayMongo's hosted checkout page. */
export default function MockCheckoutPage({ searchParams }: PageProps<"/book/mock-checkout">) {
  return (
    <section className="bg-studio">
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6 md:py-16">
        <p
          role="note"
          className="mb-4 flex items-center justify-center gap-2 rounded-full bg-terracotta px-4 py-2 text-sm font-bold text-white"
        >
          <FlaskConicalIcon className="size-4" aria-hidden />
          TEST MODE — no real money
        </p>
        <div className="rounded-[2rem] border bg-background p-6 shadow-xl sm:p-8">
          <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
            <Checkout searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

async function Checkout({ searchParams }: Pick<PageProps<"/book/mock-checkout">, "searchParams">) {
  const { ref, cs } = await searchParams;
  const reference = typeof ref === "string" ? ref : "";
  const checkoutId = typeof cs === "string" ? cs : "";
  const checkout = await getMockCheckout({ reference, checkoutId });
  if (!checkout) notFound();

  if (checkout.paid) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-lg font-semibold">This deposit is already paid.</p>
        <Button asChild>
          <Link href={`/book/done?ref=${reference}`}>Continue</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="overflow-hidden rounded-full bg-white ring-1 ring-black/5">
          <Image src="/brand/logo.jpg" alt="Light Chasers Studio" width={48} height={48} />
        </span>
        <div>
          <p className="font-semibold">Light Chasers Studio</p>
          <p className="text-sm text-muted-foreground">Booking {reference}</p>
        </div>
      </div>
      <div className="rounded-2xl bg-accent p-4 text-accent-foreground">
        <p className="text-sm">Deposit · {checkout.serviceName}</p>
        <p className="font-heading text-3xl font-semibold">{formatPeso(checkout.amountCents)}</p>
        <p className="mt-1 text-xs opacity-80">For {checkout.contactName}</p>
      </div>
      <MockCheckoutForm
        reference={reference}
        checkoutId={checkoutId}
        amountCents={checkout.amountCents}
      />
    </div>
  );
}
