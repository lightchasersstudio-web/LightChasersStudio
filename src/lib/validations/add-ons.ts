import { z } from "zod";

import { optionalText, pesoString } from "@/lib/validations/shared";

export const addOnSchema = z
  .object({
    name: z.string().trim().min(2, "Give the add-on a name.").max(80),
    description: optionalText(300),
    price: pesoString,
    isActive: z.boolean(),
  })
  .transform((v) => ({
    name: v.name,
    description: v.description,
    price_cents: v.price,
    is_active: v.isActive,
  }));

export type AddOnFormInput = z.input<typeof addOnSchema>;

export const addOnIdSchema = z.object({ id: z.uuid() });
export const setAddOnActiveSchema = z.object({ id: z.uuid(), isActive: z.boolean() });
