import type { ServiceCategory } from "@/lib/catalog";

/**
 * Client reviews shown on the home page and on package pages.
 *
 * HOW TO ADD ONE: copy a real review (with the client's permission) into
 * REVIEWS below. Use their first name or initials if they prefer.
 *
 *   {
 *     name: "Maria & Jun",
 *     category: "wedding",          // wedding | portrait | event | commercial | studio
 *     shoot: "Prenup session",      // what they booked, as you'd say it
 *     quote: "They made us feel so relaxed…",
 *     rating: 5,                    // optional, 1–5
 *   },
 *
 * While REVIEWS is empty the live site hides the section. On your own computer
 * (`npm run dev`) the SAMPLE_REVIEWS show instead, marked "sample", so you can
 * see the design. Samples never appear on the live site.
 */
export type Review = {
  name: string;
  category: ServiceCategory;
  shoot: string;
  quote: string;
  rating?: 1 | 2 | 3 | 4 | 5;
};

export const REVIEWS: Review[] = [];

/** Design preview only. Never shown in production. */
const SAMPLE_REVIEWS: Review[] = [
  {
    name: "Sample client A",
    category: "wedding",
    shoot: "Prenup session",
    quote:
      "This is a sample review. Replace it with a real one from a happy couple: what they loved about the shoot and the photos.",
    rating: 5,
  },
  {
    name: "Sample client B",
    category: "portrait",
    shoot: "Family portrait",
    quote:
      "This is a sample review. A real one might mention how the team handled the kids, or how quickly the photos arrived.",
    rating: 5,
  },
  {
    name: "Sample client C",
    category: "event",
    shoot: "Event coverage",
    quote:
      "This is a sample review. Real quotes work best when they're short and specific, two or three sentences.",
    rating: 5,
  },
];

const PREVIEW = process.env.NODE_ENV === "development";

/** Real reviews, or (dev only) the samples. `sample` tells the UI to label them. */
export function getReviews(category?: ServiceCategory): { reviews: Review[]; sample: boolean } {
  const sample = REVIEWS.length === 0 && PREVIEW;
  const all = sample ? SAMPLE_REVIEWS : REVIEWS;
  const reviews = category ? all.filter((r) => r.category === category) : all;
  return { reviews, sample };
}
