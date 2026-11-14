"use client";

import { DownloadIcon, Loader2Icon, MailIcon } from "lucide-react";
import { useTransition } from "react";

import { handleResult } from "@/components/admin/form-utils";
import { Button } from "@/components/ui/button";
import { emailPaymentReceipt } from "@/server/actions/admin-bookings";

/** A paid payment's receipt (studio policy 1.5): its number, the PDF, and send it again. */
export function PaymentReceipt({
  paymentId,
  number,
  hasEmail,
}: {
  paymentId: string;
  number: string;
  hasEmail: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      Receipt {number}
      <Button asChild variant="ghost" size="sm" className="h-8 px-2">
        <a href={`/admin/receipts/${paymentId}/pdf`} target="_blank" rel="noopener">
          <DownloadIcon aria-hidden />
          PDF
        </a>
      </Button>
      {hasEmail && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          disabled={pending}
          onClick={() =>
            start(async () => {
              handleResult(
                await emailPaymentReceipt({ paymentId }),
                `Receipt ${number} emailed to the client.`,
              );
            })
          }
        >
          {pending ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <MailIcon aria-hidden />
          )}
          Email
        </Button>
      )}
    </span>
  );
}
