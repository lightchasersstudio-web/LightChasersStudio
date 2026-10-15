import { z } from "zod";

import { SERVICE_CATEGORY_VALUES } from "@/lib/catalog";
import { STORAGE_PATH } from "@/lib/storage";
import { optionalText } from "@/lib/validations/shared";

const altText = z
  .string()
  .trim()
  .min(3, "Describe the photo in a few words (for screen readers and SEO).")
  .max(300);

export const addPortfolioImagesSchema = z.object({
  images: z
    .array(
      z.object({
        storagePath: z.string().regex(STORAGE_PATH.portfolio),
        category: z.enum(SERVICE_CATEGORY_VALUES),
        altText,
        width: z.number().int().positive().max(20000),
        height: z.number().int().positive().max(20000),
        blurDataUrl: z
          .string()
          .max(4000)
          .regex(/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/),
      }),
    )
    .min(1)
    .max(20),
});

export type AddPortfolioImagesInput = z.input<typeof addPortfolioImagesSchema>;

export const updatePortfolioImageSchema = z.object({
  id: z.uuid(),
  category: z.enum(SERVICE_CATEGORY_VALUES, "Pick a category."),
  altText,
  caption: optionalText(300),
  isFeatured: z.boolean(),
  // "" from the select means "no package".
  serviceId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
});

export type UpdatePortfolioImageInput = z.input<typeof updatePortfolioImageSchema>;

export const portfolioIdSchema = z.object({ id: z.uuid() });
