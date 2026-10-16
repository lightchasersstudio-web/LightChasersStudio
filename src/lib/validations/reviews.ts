import { z } from "zod";

import { SERVICE_CATEGORY_VALUES } from "@/lib/catalog";

export const reviewSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Add the client's name (first name or initials is fine).")
      .max(80),
    category: z.enum(SERVICE_CATEGORY_VALUES, "Pick a category."),
    shoot: z.string().trim().min(2, "Say what they booked, e.g. Prenup session.").max(80),
    quote: z
      .string()
      .trim()
      .min(10, "Paste what the client said.")
      .max(800, "Keep the quote under 800 characters."),
    // "" = no star rating
    rating: z.enum(["", "1", "2", "3", "4", "5"]),
    isPublished: z.boolean(),
  })
  .transform((v) => ({
    name: v.name,
    category: v.category,
    shoot: v.shoot,
    quote: v.quote,
    rating: v.rating ? Number(v.rating) : null,
    is_published: v.isPublished,
  }));

export type ReviewFormInput = z.input<typeof reviewSchema>;

export const reviewIdSchema = z.object({ id: z.uuid() });
export const setReviewPublishedSchema = z.object({ id: z.uuid(), isPublished: z.boolean() });
