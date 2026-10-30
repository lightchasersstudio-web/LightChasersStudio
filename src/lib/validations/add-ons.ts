import { z } from "zod";

import { optionalText, pesoString } from "@/lib/validations/shared";

export const addOnSchema = z
  .object({
    name: z.string().trim().min(2, "Give the add-on a name.").max(80),
    description: optionalText(300),
    price: pesoString,
    isActive: z.boolean(),
    /** Hours added to a package with a set length, e.g. a photobooth extension ("" = none). */
    addsHours: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d+(\.\d+)?$/.test(v) && Number(v) <= 12), {
        message: "Enter up to 12 hours, or leave it empty.",
      })
      .refine((v) => v === "" || Number.isInteger(Number(v) * 4), {
        message: "Use quarter hours, like 1 or 1.5.",
      }),
    /** Packages it's offered with; empty = every package. */
    serviceIds: z.array(z.uuid()).max(200),
  })
  .transform((v) => ({
    name: v.name,
    description: v.description,
    price_cents: v.price,
    is_active: v.isActive,
    extra_minutes: v.addsHours === "" ? 0 : Number(v.addsHours) * 60,
    service_ids: [...new Set(v.serviceIds)],
  }));

export type AddOnFormInput = z.input<typeof addOnSchema>;

export const addOnIdSchema = z.object({ id: z.uuid() });
export const setAddOnActiveSchema = z.object({ id: z.uuid(), isActive: z.boolean() });
