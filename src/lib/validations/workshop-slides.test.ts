import { describe, expect, it } from "vitest";

import {
  MAX_WORKSHOP_SLIDES,
  parseWorkshopSlides,
  saveWorkshopSlidesSchema,
} from "@/lib/validations/workshop-slides";

const id = "8f14e45f-ceea-467a-9575-6a5c2b2d0d1e";
const slide = (n: number) => ({
  path: `workshop/00000000-0000-4000-8000-${String(n).padStart(12, "0")}.webp`,
  width: 1200,
  height: 1600,
  blur: "data:image/jpeg;base64,AAAA",
});

describe("workshop slides", () => {
  it("accepts an ordered list of uploaded workshop photos", () => {
    const parsed = saveWorkshopSlidesSchema.safeParse({
      serviceId: id,
      slides: [slide(1), slide(2)],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty list (back to the automatic pick)", () => {
    expect(saveWorkshopSlidesSchema.safeParse({ serviceId: id, slides: [] }).success).toBe(true);
  });

  it("refuses paths outside the workshop folder", () => {
    const bad = { ...slide(1), path: "services/00000000-0000-4000-8000-000000000001.webp" };
    expect(saveWorkshopSlidesSchema.safeParse({ serviceId: id, slides: [bad] }).success).toBe(
      false,
    );
  });

  it("refuses duplicates and too many photos", () => {
    expect(
      saveWorkshopSlidesSchema.safeParse({ serviceId: id, slides: [slide(1), slide(1)] }).success,
    ).toBe(false);
    const many = Array.from({ length: MAX_WORKSHOP_SLIDES + 1 }, (_, i) => slide(i));
    expect(saveWorkshopSlidesSchema.safeParse({ serviceId: id, slides: many }).success).toBe(false);
  });

  it("drops malformed stored entries instead of failing", () => {
    expect(parseWorkshopSlides([slide(1), { path: "nope" }, 3])).toEqual([slide(1)]);
    expect(parseWorkshopSlides(null)).toEqual([]);
  });
});
