import { z } from "zod";

import { STORAGE_PATH } from "@/lib/storage";
import { pesosToCents } from "@/lib/utils/money";
import { isGoogleMapsUrl } from "@/lib/utils/social";
import { intString, optionalText, optionalUrl } from "@/lib/validations/shared";

export const studioProfileSchema = z
  .object({
    businessName: z.string().trim().min(1, "Enter the studio name.").max(120),
    tagline: optionalText(200),
    about: optionalText(5000),
    email: z
      .string()
      .trim()
      .max(254)
      .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address.")
      .transform((v) => v || null),
    phone: optionalText(32),
    address: optionalText(300),
    city: z.string().trim().min(1, "Enter the city.").max(80),
    // The Share link of the studio's pin; empty = search for the address.
    mapsUrl: z
      .string()
      .trim()
      .max(500, "Keep this under 500 characters.")
      .refine(
        (v) => v === "" || isGoogleMapsUrl(v),
        "Paste the link from Google Maps → Share, e.g. https://maps.app.goo.gl/…",
      )
      .default("")
      .transform((v) => v || null),
    facebookUrl: optionalUrl,
    instagramUrl: optionalUrl,
    tiktokUrl: optionalUrl,
  })
  .transform((v) => ({
    business_name: v.businessName,
    tagline: v.tagline,
    about: v.about,
    email: v.email,
    phone: v.phone,
    address: v.address,
    city: v.city,
    maps_url: v.mapsUrl,
    facebook_url: v.facebookUrl,
    instagram_url: v.instagramUrl,
    tiktok_url: v.tiktokUrl,
  }));

export type StudioProfileInput = z.input<typeof studioProfileSchema>;

export const bookingRulesSchema = z
  .object({
    minNoticeHours: intString(0, 24 * 60),
    maxAdvanceDays: intString(1, 730),
    slotIntervalMinutes: z.enum(["15", "30", "60"]).transform(Number),
    bufferMinutes: intString(0, 480),
    // Down payment %: studio packages and events (owner request 2026-11-12).
    defaultDepositPercent: intString(0, 100),
    eventsDepositPercent: intString(0, 100),
    vatPercent: intString(0, 50),
    holdMinutes: intString(5, 120),
    // Studio sessions only; outside events are one per day (owner decision 2026-11-06).
    maxConcurrentBookings: intString(1, 10),
    // Studio Policy 7.2: client details deleted this many days after the booking; 0 = never.
    personalDataDays: intString(0, 3650),
  })
  .transform((v) => ({
    min_notice_hours: v.minNoticeHours,
    max_advance_days: v.maxAdvanceDays,
    slot_interval_minutes: v.slotIntervalMinutes,
    buffer_minutes: v.bufferMinutes,
    default_deposit_percent: v.defaultDepositPercent,
    events_deposit_percent: v.eventsDepositPercent,
    vat_percent: v.vatPercent,
    hold_minutes: v.holdMinutes,
    max_concurrent_bookings: v.maxConcurrentBookings,
    personal_data_days: v.personalDataDays,
  }));

export type BookingRulesInput = z.input<typeof bookingRulesSchema>;

export const logoSchema = z.object({ logoPath: z.string().regex(STORAGE_PATH.logo).nullable() });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(200),
    newPassword: z
      .string()
      .min(10, "Use at least 10 characters.")
      .max(72, "Use at most 72 characters."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the current one.",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Studio Policy Manual & Client Agreement (studio packages agree to it when booking). */
export const studioPolicySchema = z
  .object({
    studioPolicy: z.string().trim().max(60_000, "Keep the policy under 60,000 characters."),
  })
  .transform((v) => ({ studio_policy: v.studioPolicy }));
export type StudioPolicyInput = z.input<typeof studioPolicySchema>;

/** Peso price (before VAT) for one preset charge; 0 turns that preset off. */
const chargePrice = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const cents = v === "" ? 0 : pesosToCents(v);
    if (cents === null || cents > 10_000_000) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 500, or 0." });
      return z.NEVER;
    }
    return cents;
  });

/** Extra charges after a shoot (studio policy 3.2, 4.4, 5.1, 7.8). */
export const chargePricesSchema = z
  .object({
    cleaningFee: chargePrice,
    backdropPaperYard: chargePrice,
    extraPerson: chargePrice,
    storageDay: chargePrice,
  })
  .transform((v) => ({
    cleaning_fee_cents: v.cleaningFee,
    backdrop_paper_yard_cents: v.backdropPaperYard,
    extra_person_cents: v.extraPerson,
    storage_day_cents: v.storageDay,
  }));
export type ChargePricesInput = z.input<typeof chargePricesSchema>;
