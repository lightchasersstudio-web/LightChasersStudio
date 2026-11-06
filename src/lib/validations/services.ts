import { TZDate } from "@date-fns/tz";
import { z } from "zod";

import { WORKSHOP_MAX_DAYS, workshopDays } from "@/lib/booking/workshop";
import { PACKAGE_CATEGORY_VALUES } from "@/lib/catalog";
import { STORAGE_PATH } from "@/lib/storage";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { centsToPesoInput, pesosToCents } from "@/lib/utils/money";
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
    // Added to a booking (before VAT) when it's moved to a new date or time; "" or 0 = free.
    rescheduleFee: z
      .string()
      .trim()
      .default("")
      .transform((v, ctx) => {
        if (v === "") return 0;
        const cents = pesosToCents(v);
        if (cents === null) {
          ctx.addIssue({ code: "custom", message: "Enter an amount like 500, or 0 for free." });
          return z.NEVER;
        }
        return cents;
      }),
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
    // Shown on the booking Review & pay step; clients must agree to book (empty = none).
    contract: z
      .string()
      .trim()
      .max(30000, "Keep the contract under 30,000 characters.")
      .optional()
      .transform((v) => v || null),
    isActive: z.boolean(),
    // Doesn't count toward (or get refused by) the bookings-per-day limit, e.g. the Photobooth.
    ignoresDayLimit: z.boolean().default(false),
    // Workshops only: when it runs (Manila time) and how many people can join.
    workshopDate: z.string().trim(),
    workshopStart: z.string().trim(),
    workshopEnd: z.string().trim(),
    workshopSeats: z.string().trim(),
    workshopLocation: optionalText(300),
    // Days 2 and 3 of a multi-day workshop (day 1 is workshopDate/Start/End).
    workshopExtraDays: z
      .array(
        z.object({ date: z.string().trim(), start: z.string().trim(), end: z.string().trim() }),
      )
      .max(WORKSHOP_MAX_DAYS - 1, `A workshop runs on up to ${WORKSHOP_MAX_DAYS} days.`)
      .default([]),
    // Email everyone signed up when the date, time or place changes (not stored).
    notifyWorkshopMove: z.boolean().default(true),
    // Workshops only: discounted categories (empty price = not offered).
    earlyBirdPrice: z.string().trim(),
    earlyBirdUntil: z.string().trim(),
    earlyBirdSeats: z.string().trim(),
    studentPrice: z.string().trim(),
    // Each category can be switched off on its own (all off = sign-up paused).
    regularEnabled: z.boolean(),
    earlyBirdEnabled: z.boolean(),
    studentEnabled: z.boolean(),
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
    const pricing = v.category === "workshop" ? workshopPricing(v, ctx) : NO_PRICING;
    if (!workshop || !pricing) return z.NEVER;
    return {
      name: v.name,
      slug: v.slug,
      category: v.category,
      summary: v.summary,
      description: v.description,
      duration_minutes: durationMinutes,
      price_cents: v.price,
      deposit_cents: depositCents,
      reschedule_fee_cents: v.rescheduleFee,
      inclusions: v.inclusions,
      cover_image_path: v.coverImagePath,
      contract: v.contract,
      is_active: v.isActive,
      ignores_day_limit: v.category !== "workshop" && v.ignoresDayLimit,
      ...workshop,
      ...pricing,
    };
  });

type WorkshopPricing = {
  workshop_regular_enabled: boolean;
  workshop_early_bird_enabled: boolean;
  workshop_student_enabled: boolean;
  workshop_early_bird_price_cents: number | null;
  workshop_early_bird_until: string | null;
  workshop_early_bird_seats: number | null;
  workshop_student_price_cents: number | null;
};
const NO_PRICING: WorkshopPricing = {
  workshop_regular_enabled: true,
  workshop_early_bird_enabled: true,
  workshop_student_enabled: true,
  workshop_early_bird_price_cents: null,
  workshop_early_bird_until: null,
  workshop_early_bird_seats: null,
  workshop_student_price_cents: null,
};

/**
 * The price categories: each on or off, and early-bird / student prices per
 * person (required while that category is on; kept while it's off).
 */
function workshopPricing(
  v: {
    earlyBirdPrice: string;
    earlyBirdUntil: string;
    earlyBirdSeats: string;
    studentPrice: string;
    regularEnabled: boolean;
    earlyBirdEnabled: boolean;
    studentEnabled: boolean;
  },
  ctx: z.RefinementCtx,
): WorkshopPricing | null {
  const issue = (path: string, message: string) => {
    ctx.addIssue({ code: "custom", path: [path], message });
    return null;
  };
  const price = (path: string, value: string): number | null | false => {
    if (!value) return null;
    const parsed = pesoString.safeParse(value);
    if (!parsed.success) return issue(path, parsed.error.issues[0]!.message) ?? false;
    return parsed.data;
  };
  const early = price("earlyBirdPrice", v.earlyBirdPrice);
  const student = price("studentPrice", v.studentPrice);
  if (early === false || student === false) return null;
  if (v.earlyBirdEnabled && early === null) {
    return issue("earlyBirdPrice", "Enter the early-bird price, or switch early bird off.");
  }
  if (v.studentEnabled && student === null) {
    return issue("studentPrice", "Enter the student price, or switch student off.");
  }
  if (v.earlyBirdUntil && !/^\d{4}-\d{2}-\d{2}$/.test(v.earlyBirdUntil)) {
    return issue("earlyBirdUntil", "Pick the last day of early bird.");
  }
  let seats: number | null = null;
  if (v.earlyBirdSeats) {
    if (!/^\d+$/.test(v.earlyBirdSeats) || Number(v.earlyBirdSeats) < 1) {
      return issue("earlyBirdSeats", "Enter a whole number, or leave it empty for no limit.");
    }
    seats = Number(v.earlyBirdSeats);
  }
  return {
    workshop_regular_enabled: v.regularEnabled,
    workshop_early_bird_enabled: v.earlyBirdEnabled,
    workshop_student_enabled: v.studentEnabled,
    workshop_early_bird_price_cents: early,
    workshop_early_bird_until: early === null ? null : v.earlyBirdUntil || null,
    workshop_early_bird_seats: early === null ? null : seats,
    workshop_student_price_cents: student,
  };
}

type WorkshopSchedule = {
  workshop_starts_at: string | null;
  workshop_ends_at: string | null;
  workshop_seats: number | null;
  workshop_location: string | null;
  /** Every day, in order (first day's start = workshop_starts_at, last day's end = workshop_ends_at). */
  workshop_days: { starts_at: string; ends_at: string }[];
};
const NO_SCHEDULE: WorkshopSchedule = {
  workshop_starts_at: null,
  workshop_ends_at: null,
  workshop_seats: null,
  workshop_location: null,
  workshop_days: [],
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
    workshopExtraDays: { date: string; start: string; end: string }[];
  },
  ctx: z.RefinementCtx,
): WorkshopSchedule | null {
  const issue = (path: string | (string | number)[], message: string) => {
    ctx.addIssue({ code: "custom", path: Array.isArray(path) ? path : [path], message });
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
    if (v.workshopExtraDays.length > 0) {
      return issue("workshopDate", "Set day 1 first, or remove the other days.");
    }
    return { ...NO_SCHEDULE, workshop_seats: seats, workshop_location: v.workshopLocation };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.workshopDate))
    return issue("workshopDate", "Pick the workshop date.");
  if (!TIME.test(v.workshopStart)) return issue("workshopStart", "Pick the start time.");
  if (!TIME.test(v.workshopEnd)) return issue("workshopEnd", "Pick the end time.");
  if (v.workshopEnd <= v.workshopStart) {
    return issue("workshopEnd", "The end time must be after the start time.");
  }
  const at = (date: string, time: string) => {
    const [y, m, d] = date.split("-").map(Number) as [number, number, number];
    const [h, min] = time.split(":").map(Number) as [number, number];
    return new Date(new TZDate(y, m - 1, d, h, min, BUSINESS_TZ).getTime()).toISOString();
  };
  const days = [
    { starts_at: at(v.workshopDate, v.workshopStart), ends_at: at(v.workshopDate, v.workshopEnd) },
  ];
  let previousDate = v.workshopDate;
  for (const [i, day] of v.workshopExtraDays.entries()) {
    const path = (field: string) => ["workshopExtraDays", i, field];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date))
      return issue(path("date"), `Pick day ${i + 2}'s date.`);
    if (day.date <= previousDate) {
      return issue(path("date"), `Day ${i + 2} must be after day ${i + 1}.`);
    }
    if (!TIME.test(day.start)) return issue(path("start"), "Pick the start time.");
    if (!TIME.test(day.end)) return issue(path("end"), "Pick the end time.");
    if (day.end <= day.start)
      return issue(path("end"), "The end time must be after the start time.");
    days.push({ starts_at: at(day.date, day.start), ends_at: at(day.date, day.end) });
    previousDate = day.date;
  }
  return {
    workshop_starts_at: days[0]!.starts_at,
    workshop_ends_at: days.at(-1)!.ends_at,
    workshop_seats: seats,
    workshop_location: v.workshopLocation,
    workshop_days: days,
  };
}

/** Stored workshop times → the form's Manila date and times ("" when not set). */
export function workshopFormValues(service: {
  workshop_starts_at: string | null;
  workshop_ends_at: string | null;
  workshop_days?: unknown;
  workshop_seats: number | null;
  workshop_location: string | null;
  workshop_early_bird_price_cents: number | null;
  workshop_early_bird_until: string | null;
  workshop_early_bird_seats: number | null;
  workshop_student_price_cents: number | null;
  workshop_regular_enabled: boolean;
  workshop_early_bird_enabled: boolean;
  workshop_student_enabled: boolean;
}) {
  const local = (iso: string | null, part: "date" | "time") => {
    if (!iso) return "";
    const d = new TZDate(iso, BUSINESS_TZ);
    const pad = (n: number) => String(n).padStart(2, "0");
    return part === "date"
      ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [first, ...rest] = workshopDays(service);
  return {
    workshopDate: local(first?.startsAt ?? null, "date"),
    workshopStart: local(first?.startsAt ?? null, "time"),
    workshopEnd: local(first?.endsAt ?? null, "time"),
    workshopExtraDays: rest.map((d) => ({
      date: local(d.startsAt, "date"),
      start: local(d.startsAt, "time"),
      end: local(d.endsAt, "time"),
    })),
    workshopSeats: service.workshop_seats === null ? "" : String(service.workshop_seats),
    workshopLocation: service.workshop_location ?? "",
    notifyWorkshopMove: true,
    earlyBirdPrice:
      service.workshop_early_bird_price_cents === null
        ? ""
        : centsToPesoInput(service.workshop_early_bird_price_cents),
    earlyBirdUntil: service.workshop_early_bird_until ?? "",
    earlyBirdSeats:
      service.workshop_early_bird_seats === null ? "" : String(service.workshop_early_bird_seats),
    studentPrice:
      service.workshop_student_price_cents === null
        ? ""
        : centsToPesoInput(service.workshop_student_price_cents),
    regularEnabled: service.workshop_regular_enabled,
    // Shown as on only when there's a price to offer (older rows had none).
    earlyBirdEnabled:
      service.workshop_early_bird_enabled && service.workshop_early_bird_price_cents !== null,
    studentEnabled:
      service.workshop_student_enabled && service.workshop_student_price_cents !== null,
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
