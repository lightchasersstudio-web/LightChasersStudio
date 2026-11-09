import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cutoffLabel, shiftCutoff, type Cutoff } from "@/lib/payroll/cutoff";

/** ‹ Nov 1–15, 2026 › with a "This cut-off" shortcut. `href` builds each link. */
export function CutoffPicker({
  cutoff,
  current,
  href,
}: {
  cutoff: Cutoff;
  current: Cutoff;
  href: (start: string) => string;
}) {
  const prev = shiftCutoff(cutoff, -1);
  const next = shiftCutoff(cutoff, 1);
  return (
    <nav aria-label="Cut-off" className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="icon">
        <Link href={href(prev.start)} aria-label={`Previous cut-off, ${cutoffLabel(prev)}`}>
          <ChevronLeftIcon aria-hidden />
        </Link>
      </Button>
      <p className="min-w-40 text-center font-heading text-lg font-semibold" aria-live="polite">
        {cutoffLabel(cutoff)}
      </p>
      <Button asChild variant="outline" size="icon">
        <Link href={href(next.start)} aria-label={`Next cut-off, ${cutoffLabel(next)}`}>
          <ChevronRightIcon aria-hidden />
        </Link>
      </Button>
      {cutoff.start !== current.start && (
        <Button asChild variant="ghost">
          <Link href={href(current.start)}>This cut-off</Link>
        </Button>
      )}
    </nav>
  );
}
