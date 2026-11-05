import type { ServiceCategory } from "@/lib/catalog";
import type { PublicReview } from "@/server/queries/public";

/**
 * Real reviews are managed at /admin/reviews. While none are published, the
 * live site hides the reviews section; on your own computer (`npm run dev`)
 * these samples show instead, marked "sample", so you can see the design.
 */
const SAMPLE_REVIEWS: PublicReview[] = [
  {
    id: "sample-a",
    name: "Sample client A",
    category: "wedding",
    shoot: "Prenup session",
    quote:
      "This is a sample review. Replace it with a real one from a happy couple: what they loved about the shoot and the photos.",
    rating: 5,
  },
  {
    id: "sample-b",
    name: "Sample client B",
    category: "portrait",
    shoot: "Family portrait",
    quote:
      "This is a sample review. A real one might mention how the team handled the kids, or how quickly the photos arrived.",
    rating: 5,
  },
  {
    id: "sample-c",
    name: "Sample client C",
    category: "event",
    shoot: "Event coverage",
    quote:
      "This is a sample review. Real quotes work best when they're short and specific, two or three sentences.",
    rating: 5,
  },
];

const PREVIEW = process.env.NODE_ENV === "development";

/** Published reviews, or (dev only, when there are none) the samples. `sample` tells the UI to label them. */
export function pickReviews(
  published: PublicReview[],
  category?: ServiceCategory,
): { reviews: PublicReview[]; sample: boolean } {
  const sample = published.length === 0 && PREVIEW;
  const all = sample ? SAMPLE_REVIEWS : published;
  const reviews = category ? all.filter((r) => r.category === category) : all;
  return { reviews, sample };
}
