import { z } from "zod";

import { STORAGE_PATH } from "@/lib/storage";
import type { Json } from "@/types/database.types";

/** Most photos in the workshop banner's slideshow (the column's check allows 12). */
export const MAX_WORKSHOP_SLIDES = 12;

/** One photo in the workshop banner slideshow, as stored in `services.workshop_slides`. */
export const workshopSlideSchema = z.object({
  path: z.string().regex(STORAGE_PATH.workshopSlide),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  blur: z
    .string()
    .max(4000)
    .regex(/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/)
    .nullable(),
});

export type WorkshopSlide = z.infer<typeof workshopSlideSchema>;

export const saveWorkshopSlidesSchema = z.object({
  serviceId: z.uuid(),
  slides: z
    .array(workshopSlideSchema)
    .max(MAX_WORKSHOP_SLIDES, `Up to ${MAX_WORKSHOP_SLIDES} photos.`)
    .refine((s) => new Set(s.map((x) => x.path)).size === s.length, "A photo is listed twice."),
});

/** Reads the stored column; anything malformed is dropped rather than breaking the page. */
export function parseWorkshopSlides(value: Json): WorkshopSlide[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    const parsed = workshopSlideSchema.safeParse(v);
    return parsed.success ? [parsed.data] : [];
  });
}
