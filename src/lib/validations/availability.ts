import { z } from "zod";

import { WEEKDAYS } from "@/lib/catalog";
import { dateString, optionalText, timeString } from "@/lib/validations/shared";

const windowSchema = z.object({ start: timeString, end: timeString });

/** Form shape: one entry per weekday (index 0 = Sunday). */
export const weeklyHoursSchema = z
  .object({
    days: z
      .array(z.object({ open: z.boolean(), windows: z.array(windowSchema).max(10) }))
      .length(7),
  })
  .superRefine(({ days }, ctx) => {
    days.forEach((day, d) => {
      if (!day.open) return;
      if (day.windows.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["days", d, "windows"],
          message: `Add opening hours for ${WEEKDAYS[d]} or mark it closed.`,
        });
      }
      day.windows.forEach((w, i) => {
        if (w.end <= w.start) {
          ctx.addIssue({
            code: "custom",
            path: ["days", d, "windows", i, "end"],
            message: "Closing time must be after opening time.",
          });
        }
      });
      const sorted = [...day.windows].sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i]!.start < sorted[i - 1]!.end) {
          ctx.addIssue({
            code: "custom",
            path: ["days", d, "windows"],
            message: `${WEEKDAYS[d]} has overlapping hours.`,
          });
          break;
        }
      }
    });
  })
  .transform(({ days }) =>
    days.flatMap((day, d) =>
      day.open
        ? day.windows.map((w) => ({ day_of_week: d, start_time: w.start, end_time: w.end }))
        : [],
    ),
  );

export type WeeklyHoursInput = z.input<typeof weeklyHoursSchema>;

/** Block one day, or a range of up to 62 days. `today` is the business-local date. */
export const blackoutSchema = z
  .object({
    from: dateString,
    to: z.union([z.literal(""), dateString]),
    reason: optionalText(200),
    today: dateString,
  })
  .superRefine((v, ctx) => {
    if (v.from < v.today) {
      ctx.addIssue({ code: "custom", path: ["from"], message: "Pick today or a future date." });
    }
    if (v.to && v.to < v.from) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "End date must be on or after the start.",
      });
    }
    if (v.to && daysBetween(v.from, v.to) > 61) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "Block at most 62 days at a time." });
    }
  })
  .transform((v) => ({ dates: datesInRange(v.from, v.to || v.from), reason: v.reason }));

export type BlackoutInput = z.input<typeof blackoutSchema>;

export const blackoutIdSchema = z.object({ id: z.uuid() });

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** Inclusive list of YYYY-MM-DD dates (computed in UTC, so no DST drift). */
export function datesInRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
