import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { FileSignatureIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { BUSINESS_TZ } from "@/lib/utils/business-date";

/**
 * The contract wording saved with a booking, folded away under a summary line
 * ("Agreed on …"). Used on the admin booking page and the client's booking page.
 */
export function AgreedContract({
  text,
  acceptedAt,
  title = "Contract",
  className,
}: {
  text: string;
  acceptedAt: string;
  title?: string;
  className?: string;
}) {
  return (
    <details className={cn("group rounded-3xl border bg-card p-5", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-terracotta-ink">
          <FileSignatureIcon className="size-5" aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-muted-foreground">
            Agreed on {format(new TZDate(acceptedAt, BUSINESS_TZ), "EEE, d MMM yyyy 'at' h:mm a")} ·{" "}
            <span className="group-open:hidden">show</span>
            <span className="hidden group-open:inline">hide</span>
          </span>
        </span>
      </summary>
      <div className="mt-4 max-h-[28rem] overflow-y-auto rounded-2xl bg-background p-4 text-sm leading-relaxed whitespace-pre-line">
        {text}
      </div>
    </details>
  );
}
