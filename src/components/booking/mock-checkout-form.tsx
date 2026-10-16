"use client";

import { CreditCardIcon, Loader2Icon, SmartphoneIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { handleResult } from "@/components/admin/form-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/utils/money";
import { mockPay } from "@/server/actions/mock-payment";

const METHODS = [
  { value: "gcash", label: "GCash", icon: SmartphoneIcon },
  { value: "card", label: "Card", icon: CreditCardIcon },
  { value: "maya", label: "Maya", icon: WalletIcon },
] as const;

/** Trial-mode stand-in for PayMongo's checkout. The method choice is just for show. */
export function MockCheckoutForm({
  reference,
  checkoutId,
  amountCents,
}: {
  reference: string;
  checkoutId: string;
  amountCents: number;
}) {
  const [method, setMethod] = useState<string>("gcash");
  const [paying, startPaying] = useTransition();

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Pay with</legend>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border bg-background text-sm font-semibold",
                "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                method === value && "border-primary bg-accent/60",
              )}
            >
              <input
                type="radio"
                name="method"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
                className="sr-only"
              />
              <Icon className="size-5" aria-hidden />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={paying}
        onClick={() =>
          startPaying(async () => {
            const result = await mockPay({ reference, checkoutId });
            if (handleResult(result, "")) window.location.assign(result.data.redirectUrl);
          })
        }
      >
        {paying && <Loader2Icon className="animate-spin" aria-hidden />}
        Pay {formatPeso(amountCents)} (test)
      </Button>
      <Button asChild variant="ghost" className="w-full">
        <Link href={`/book/cancelled?ref=${reference}`}>Cancel and go back</Link>
      </Button>
    </div>
  );
}
