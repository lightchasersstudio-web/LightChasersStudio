import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cutoffLabel, type Cutoff } from "@/lib/payroll/cutoff";
import type { PayrollFlow } from "@/lib/payroll/flow";
import { BUSINESS_TZ } from "@/lib/utils/business-date";

const savedWhen = (iso: string) => format(new TZDate(iso, BUSINESS_TZ), "d MMM yyyy, h:mm a");

/**
 * On the time record: is the cut-off's payroll saved, and does it still match?
 * Same check as the Payroll page, so both pages say the same thing.
 */
export function PayrollSavedNotice({ cutoff, flow }: { cutoff: Cutoff; flow: PayrollFlow }) {
  const { savedAt } = flow;
  if (!savedAt) return null;
  if (flow.changed) {
    return (
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl border border-terracotta/40 bg-blush/40 p-4 text-sm">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
        <p className="flex-1">
          <strong>The saved payroll for {cutoffLabel(cutoff)} is out of date.</strong> Days or pay
          changed after it was saved ({savedWhen(savedAt)}). Save the payroll again so the payslips
          match.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/payroll?cutoff=${cutoff.start}&view=preview`}>Go to payroll</Link>
        </Button>
      </div>
    );
  }
  return (
    <p className="flex gap-2 rounded-2xl border border-sage bg-sage/15 p-4 text-sm">
      <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span>
        <strong>The payroll for {cutoffLabel(cutoff)} is saved</strong> ({savedWhen(savedAt)}) and
        matches this time record. If you change any days, save the payroll again afterwards.
      </span>
    </p>
  );
}
