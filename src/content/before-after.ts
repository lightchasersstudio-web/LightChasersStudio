/**
 * Before/after editing comparisons shown on the home page.
 *
 * HOW TO ADD ONE: export the same photo twice (straight out of the camera, and
 * your final edit), both the same size, and put them in `public/before-after/`.
 * Then add an entry below, e.g.
 *
 *   {
 *     before: "/before-after/prenup-1-before.jpg",
 *     after: "/before-after/prenup-1-after.jpg",
 *     width: 1600,
 *     height: 1067,
 *     alt: "Couple walking at Pasonanca Park at sunset",
 *     caption: "Prenup · warm golden-hour edit",
 *   },
 *
 * While this list is empty the live site hides the section. On your own
 * computer (`npm run dev`) a sample appears, clearly marked, so you can see it.
 */
export type BeforeAfterPair = {
  before: string;
  after: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
};

export const BEFORE_AFTER: BeforeAfterPair[] = [];
