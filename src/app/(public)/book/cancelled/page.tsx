import { WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PaymentRetry } from "@/components/booking/payment-retry";
import { Skeleton } from "@/components/ui/skeleton";
import { REFERENCE_RE } from "@/lib/booking/reference";
import { getServerEnv } from "@/lib/env.server";
import { acceptedPaymentMethods } from "@/lib/payments/paymongo";

export const metadata: Metadata = { title: "Payment not finished", robots: { index: false } };

/** PayMongo's cancel URL: the slot stays held until the hold expires. */
export default function PaymentCancelledPage({ searchParams }: PageProps<"/book/cancelled">) {
  return (
    <section className="bg-studio">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 md:py-16">
        <div className="text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-accent text-terracotta-ink">
            <WalletIcon className="size-8" aria-hidden />
          </span>
          <p className="mt-4 font-script text-2xl text-terracotta-ink">no worries</p>
          <h1 className="mt-1 text-4xl font-semibold">Your payment wasn&apos;t finished</h1>
          <p className="mx-auto mt-3 max-w-md text-lg text-muted-foreground">
            Your booking isn&apos;t paid yet. While your time is still held, you can try again
            below.
          </p>
        </div>
        <div className="mt-8">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-[2rem]" />}>
            <Retry searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

async function Retry({ searchParams }: Pick<PageProps<"/book/cancelled">, "searchParams">) {
  const { ref } = await searchParams;
  const raw = (Array.isArray(ref) ? ref[0] : ref)?.toUpperCase() ?? "";
  return (
    <PaymentRetry
      reference={REFERENCE_RE.test(raw) ? raw : ""}
      paymentMethods={acceptedPaymentMethods()}
      qrCode={getServerEnv().PAYMONGO_PAYMENT_METHODS.includes("qrph")}
    />
  );
}
