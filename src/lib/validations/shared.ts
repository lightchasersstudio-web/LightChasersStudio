import { z } from "zod";

import { pesosToCents } from "@/lib/utils/money";

// Form inputs are strings; these helpers parse them into DB-ready values so the
// same schema validates the form (client) and the server action (server).

/** Optional free text: trimmed, length-capped, "" → null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => v || null);

/** Whole number typed into an input. */
export const intString = (min: number, max: number) =>
  z
    .string()
    .trim()
    // "1,000" is fine too.
    .transform((v) => v.replace(/,(?=\d{3}\b)/g, ""))
    .pipe(z.string().regex(/^\d+$/, "Enter a whole number."))
    .transform(Number)
    .pipe(
      z
        .number()
        .min(min, `Must be at least ${min.toLocaleString("en-PH")}.`)
        .max(max, `Must be at most ${max.toLocaleString("en-PH")}.`),
    );

/** Peso amount typed into an input → centavos. */
export const pesoString = z.string().transform((v, ctx) => {
  const cents = pesosToCents(v);
  if (cents === null) {
    ctx.addIssue({ code: "custom", message: "Enter an amount like 1500 or 1500.50." });
    return z.NEVER;
  }
  return cents;
});

/** Optional https URL, "" → null. */
export const optionalUrl = z
  .string()
  .trim()
  .max(300, "Keep this under 300 characters.")
  .refine(
    (v) => v === "" || /^https:\/\/[^\s]+\.[^\s]+$/.test(v),
    "Use a full link starting with https://",
  )
  .transform((v) => v || null);

export const uuid = z.uuid();

/** "HH:MM" 24-hour time. */
export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:00.");

/** "YYYY-MM-DD" calendar date. */
export const dateString = z.iso.date("Pick a date.");
