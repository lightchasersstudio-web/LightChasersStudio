import { z } from "zod";

import { SERVICE_CATEGORY_VALUES } from "@/lib/catalog";
import { STORAGE_PATH } from "@/lib/storage";
import { intString, optionalText, pesoString } from "@/lib/validations/shared";

export const serviceSchema = z
  .object({
    name: z.string().trim().min(2, "Give the service a name.").max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, "Add a URL name.")
      .max(120)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes only."),
    category: z.enum(SERVICE_CATEGORY_VALUES, "Pick a category."),
    summary: optionalText(300),
    description: optionalText(5000),
    durationMinutes: intString(15, 24 * 60),
    price: pesoString,
    depositMode: z.enum(["default", "fixed"]),
    deposit: z.string(),
    inclusions: z
      .string()
      .max(4000)
      .transform((v) =>
        v
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      )
      .pipe(
        z
          .array(z.string().max(200, "Keep each inclusion under 200 characters."))
          .max(30, "Up to 30 inclusions."),
      ),
    coverImagePath: z.string().regex(STORAGE_PATH.serviceCover).nullable(),
    isActive: z.boolean(),
  })
  .transform((v, ctx) => {
    let depositCents: number | null = null;
    if (v.depositMode === "fixed") {
      const parsed = pesoString.safeParse(v.deposit);
      if (!parsed.success) {
        ctx.addIssue({
          code: "custom",
          path: ["deposit"],
          message: parsed.error.issues[0]!.message,
        });
        return z.NEVER;
      }
      if (parsed.data > v.price) {
        ctx.addIssue({
          code: "custom",
          path: ["deposit"],
          message: "Deposit can't be more than the price.",
        });
        return z.NEVER;
      }
      depositCents = parsed.data;
    }
    return {
      name: v.name,
      slug: v.slug,
      category: v.category,
      summary: v.summary,
      description: v.description,
      duration_minutes: v.durationMinutes,
      price_cents: v.price,
      deposit_cents: depositCents,
      inclusions: v.inclusions,
      cover_image_path: v.coverImagePath,
      is_active: v.isActive,
    };
  });

export type ServiceFormInput = z.input<typeof serviceSchema>;

export const serviceIdSchema = z.object({ id: z.uuid() });
export const setServiceActiveSchema = z.object({ id: z.uuid(), isActive: z.boolean() });
export const reorderSchema = z.object({ ids: z.array(z.uuid()).min(1).max(1000) });

/** "Wedding Gold Package!" → "wedding-gold-package" */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
