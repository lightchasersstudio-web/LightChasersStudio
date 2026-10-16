import { QuoteIcon, StarIcon } from "lucide-react";

import { SectionHeading } from "@/components/public/section-heading";
import { Reveal, RevealItem, RevealList } from "@/components/shared/reveal";
import { getReviews, type Review } from "@/content/reviews";
import type { ServiceCategory } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Client quotes from `src/content/reviews.ts`. Renders nothing when there are
 * none to show (so the live site never shows placeholder reviews).
 */
export function ReviewsSection({
  category,
  title = "What clients say",
  className,
}: {
  /** Only reviews for this kind of shoot (package pages). */
  category?: ServiceCategory;
  title?: string;
  className?: string;
}) {
  const { reviews, sample } = getReviews(category);
  if (reviews.length === 0) return null;

  return (
    <section
      aria-labelledby="reviews"
      className={cn("mx-auto max-w-6xl px-4 py-20 sm:px-6", className)}
    >
      <Reveal>
        <SectionHeading id="reviews" eyebrow="kind words" title={title} align="center" />
        {sample && (
          <p className="mx-auto mt-4 w-fit rounded-full border border-dashed border-terracotta/60 bg-blush/60 px-4 py-1.5 text-center text-sm">
            <strong>Sample reviews</strong> (only you can see these). Add real ones in{" "}
            <code className="font-mono text-xs">src/content/reviews.ts</code>.
          </p>
        )}
      </Reveal>
      {/* Phones: swipe sideways. Wider screens: a grid. */}
      <RevealList className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
        {reviews.map((r, i) => (
          <RevealItem key={`${r.name}-${i}`} className="w-[85%] shrink-0 snap-center sm:w-auto">
            <ReviewCard review={r} tilt={i % 2 ? "rotate-1" : "-rotate-1"} />
          </RevealItem>
        ))}
      </RevealList>
    </section>
  );
}

function ReviewCard({ review, tilt }: { review: Review; tilt: string }) {
  const initials = review.name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <figure
      className={cn(
        "relative flex h-full flex-col rounded-3xl border bg-card p-6 transition-all duration-300 hover:rotate-0 hover:shadow-lg motion-reduce:rotate-0",
        tilt,
      )}
    >
      <QuoteIcon
        className="absolute top-5 right-5 size-8 fill-blush text-terracotta/40"
        aria-hidden
      />
      {review.rating && (
        <p className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <StarIcon
              key={i}
              className={cn(
                "size-4",
                i < review.rating! ? "fill-terracotta text-terracotta" : "text-border",
              )}
              aria-hidden
            />
          ))}
        </p>
      )}
      <blockquote className="mt-4 flex-1 text-lg leading-relaxed">“{review.quote}”</blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary font-heading font-semibold text-secondary-foreground"
          aria-hidden
        >
          {initials}
        </span>
        <span>
          <span className="block font-semibold">{review.name}</span>
          <span className="block font-script text-lg leading-none text-terracotta-ink">
            {review.shoot}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}
