import { CheckIcon, ClockIcon } from "lucide-react";
import Link from "next/link";

import { SectionHeading } from "@/components/public/section-heading";
import { bookHref } from "@/components/public/site-nav";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils/format";
import { formatPeso } from "@/lib/utils/money";
import type { PublicService } from "@/server/queries/public";

/**
 * Side-by-side look at the packages of one kind of shoot (only when there are
 * at least two), with the one being viewed highlighted.
 */
export function PackageCompare({
  packages,
  currentId,
  categoryName,
  vatPercent,
}: {
  packages: PublicService[];
  currentId: string;
  categoryName: string;
  vatPercent: number;
}) {
  if (packages.length < 2) return null;
  const sorted = [...packages].sort((a, b) => a.price_cents - b.price_cents);

  return (
    <section aria-labelledby="compare" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <Reveal>
        <SectionHeading
          id="compare"
          eyebrow="side by side"
          title={`Compare ${categoryName.toLowerCase()} packages`}
          description={vatPercent > 0 ? `Prices are before ${vatPercent}% VAT.` : undefined}
        />
      </Reveal>
      {/* Phones: swipe sideways. Wider screens: all packages in a row. */}
      <div className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-3 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {sorted.map((p) => {
          const current = p.id === currentId;
          const inclusions = p.inclusions as string[];
          return (
            <article
              key={p.id}
              aria-current={current ? "page" : undefined}
              className={cn(
                "relative flex w-[80%] shrink-0 snap-center flex-col rounded-3xl border bg-card p-5 transition-shadow hover:shadow-lg sm:w-auto",
                current && "border-primary ring-1 ring-primary",
              )}
            >
              {current && (
                <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                  You&apos;re viewing
                </span>
              )}
              <h3 className="font-heading text-xl font-semibold">{p.name}</h3>
              <p className="mt-1 flex items-baseline gap-3">
                <span className="font-heading text-2xl font-semibold">
                  {formatPeso(p.price_cents)}
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <ClockIcon className="size-3.5" aria-hidden />
                  {formatDuration(p.duration_minutes)}
                </span>
              </p>
              {inclusions.length > 0 ? (
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {inclusions.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 flex-1 text-sm text-muted-foreground">
                  {p.summary ?? "Message us for the full details."}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild variant={current ? "default" : "outline"}>
                  <Link href={bookHref(p.slug)}>Book</Link>
                </Button>
                {!current && (
                  <Button asChild variant="ghost">
                    <Link href={`/services/${p.slug}`}>Details</Link>
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
