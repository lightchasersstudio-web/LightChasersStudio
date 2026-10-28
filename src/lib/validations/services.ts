import { TZDate } from "@date-fns/tz";
import { z } from "zod";

import { PACKAGE_CATEGORY_VALUES } from "@/lib/catalog";
import { STORAGE_PATH } from "@/lib/storage";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { optionalText, pesoString } from "@/lib/validations/shared";

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
    category: z.enum(PACKAGE_CATEGORY_VALUES, "Pick a category."),
    summary: optionalText(300),
    description: optionalText(5000),
    // Only packages like the Photobooth have a set length; others are just a start time.
    hasSetLength: z.boolean(),
    lengthHours: z.string().trim(),
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
    // Workshops only: when it runs (Manila time) and how many people can join.
    workshopDate: z.string().trim(),
    workshopStart: z.string().trim(),
    workshopEnd: z.string().trim(),
    workshopSeats: z.string().trim(),
    workshopLocation: optionalText(300),
  })
  .transform((v, ctx) => {
    let durationMinutes: number | null = null;
    if (v.hasSetLength) {
      const hours = Number(v.lengthHours);
      if (!/^\d+(\.\d+)?$/.test(v.lengthHours) || hours < 0.5 || hours > 24) {
        ctx.addIssue({
          code: "custom",
          path: ["lengthHours"],
          message: "Enter the length in hours, from 0.5 to 24.",
        });
        return z.NEVER;
      }
      if (!Number.isInteger(hours * 4)) {
        ctx.addIssue({
          code: "custom",
          path: ["lengthHours"],
          message: "Use quarter hours, like 4 or 4.5.",
        });
        return z.NEVER;
      }
      durationMinutes = hours * 60;
    }

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

    const workshop = v.category === "workshop" ? workshopSchedule(v, ctx) : NO_SCHEDULE;
    if (!workshop) return z.NEVER;
    return {
      name: v.name,
      slug: v.slug,
      category: v.category,
      summary: v.summary,
      description: v.description,
      duration_minutes: durationMinutes,
      price_cents: v.price,
      deposit_cents: depositCents,
      inclusions: v.inclusions,
      cover_image_path: v.coverImagePath,
      is_active: v.isActive,
      ...workshop,
    };
  });

type WorkshopSchedule = {
  workshop_starts_at: string | null;
  workshop_ends_at: string | null;
  workshop_seats: number | null;
  workshop_location: string | null;
};
const NO_SCHEDULE: WorkshopSchedule = {
  workshop_starts_at: null,
  workshop_ends_at: null,
  workshop_seats: null,
  workshop_location: null,
};
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Manila date + times → stored timestamps; all empty = date not announced yet. */
function workshopSchedule(
  v: {
    workshopDate: string;
    workshopStart: string;
    workshopEnd: string;
    workshopSeats: string;
    workshopLocation: string | null;
  },
  ctx: z.RefinementCtx,
): WorkshopSchedule | null {
  const issue = (path: string, message: string) => {
    ctx.addIssue({ code: "custom", path: [path], message });
    return null;
  };
  let seats: number | null = null;
  if (v.workshopSeats) {
    if (
      !/^\d+$/.test(v.workshopSeats) ||
      Number(v.workshopSeats) < 1 ||
      Number(v.workshopSeats) > 10_000
    ) {
      return issue(
        "workshopSeats",
        "Enter a whole number of seats, or leave it empty for no limit.",
      );
    }
    seats = Number(v.workshopSeats);
  }
  if (!v.workshopDate && !v.workshopStart && !v.workshopEnd) {
    return { ...NO_SCHEDULE, workshop_seats: seats, workshop_location: v.workshopLocation };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.workshopDate))
    return issue("workshopDate", "Pick the workshop date.");
  if (!TIME.test(v.workshopStart)) return issue("workshopStart", "Pick the start time.");
  if (!TIME.test(v.workshopEnd)) return issue("workshopEnd", "Pick the end time.");
  if (v.workshopEnd <= v.workshopStart) {
    return issue("workshopEnd", "The end time must be after the start time.");
  }
  const at = (time: string) => {
    const [y, m, d] = v.workshopDate.split("-").map(Number) as [number, number, number];
    const [h, min] = time.split(":").map(Number) as [number, number];
    return new Date(new TZDate(y, m - 1, d, h, min, BUSINESS_TZ).getTime()).toISOString();
  };
  return {
    workshop_starts_at: at(v.workshopStart),
    workshop_ends_at: at(v.workshopEnd),
    workshop_seats: seats,
    workshop_location: v.workshopLocation,
  };
}

/** Stored workshop times → the form's Manila date and times ("" when not set). */
export function workshopFormValues(service: {
  workshop_starts_at: string | null;
  workshop_ends_at: string | null;
  workshop_seats: number | null;
  workshop_location: string | null;
}) {
  const local = (iso: string | null, part: "date" | "time") => {
    if (!iso) return "";
    const d = new TZDate(iso, BUSINESS_TZ);
    const pad = (n: number) => String(n).padStart(2, "0");
    return part === "date"
      ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return {
    workshopDate: local(service.workshop_starts_at, "date"),
    workshopStart: local(service.workshop_starts_at, "time"),
    workshopEnd: local(service.workshop_ends_at, "time"),
    workshopSeats: service.workshop_seats === null ? "" : String(service.workshop_seats),
    workshopLocation: service.workshop_location ?? "",
  };
}

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
