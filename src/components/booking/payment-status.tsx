"use client";

import { CheckCircle2Icon, ClockIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { formatPeso } from "@/lib/utils/money";
import { bookingPaymentStatus, type PaymentState } from "@/server/actions/booking";

const EVERY_MS = 4000;
const GIVE_UP_AFTER = 45; // about 3 minutes

/**
 * "Waiting for PayMongo…" that turns into "Payment received ₱1,176" once the
 * webhook has settled the booking. Only with the email from this tab's booking.
 */
export function PaymentStatus({ reference, email }: { reference: string; email: string }) {
  const [state, setState] = useState<PaymentState | "slow">("waiting");
  const [paidCents, setPaidCents] = useState(0);

  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    async function check() {
      tries++;
      const result = await bookingPaymentStatus({ reference, email }).catch(() => null);
      if (stopped) return;
      if (result?.ok && result.data.state !== "waiting") {
        setState(result.data.state);
        setPaidCents(result.data.paidCents);
        return;
      }
      if (!result?.ok && result?.error === "Booking not found.") return setState("closed");
      if (tries >= GIVE_UP_AFTER) return setState("slow");
      timer = setTimeout(check, EVERY_MS);
    }
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [reference, email]);

  if (state === "closed") return null;
  return (
    <p
      role="status"
      className={
        state === "paid" || state === "received"
          ? "mx-auto mt-6 flex w-fit animate-in items-center gap-2 rounded-full bg-sage/30 px-5 py-2.5 font-semibold duration-300 zoom-in-95"
          : "mx-auto mt-6 flex w-fit items-center gap-2 rounded-full bg-background/80 px-5 py-2.5 text-sm text-muted-foreground"
      }
    >
      {state === "waiting" && (
        <>
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          Confirming your payment with PayMongo…
        </>
      )}
      {state === "slow" && (
        <>
          <ClockIcon className="size-4" aria-hidden />
          Still confirming. We&apos;ll email you as soon as it&apos;s through.
        </>
      )}
      {state === "paid" && (
        <>
          <CheckCircle2Icon className="size-5 text-primary" aria-hidden />
          Payment received: {formatPeso(paidCents)}
        </>
      )}
      {state === "received" && (
        <>
          <CheckCircle2Icon className="size-5 text-primary" aria-hidden />
          Booking received
        </>
      )}
    </p>
  );
}
