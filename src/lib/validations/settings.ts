import { z } from "zod";

import { STORAGE_PATH } from "@/lib/storage";
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
    defaultDepositPercent: intString(0, 100),
    holdMinutes: intString(5, 120),
  })
  .transform((v) => ({
    min_notice_hours: v.minNoticeHours,
    max_advance_days: v.maxAdvanceDays,
    slot_interval_minutes: v.slotIntervalMinutes,
    buffer_minutes: v.bufferMinutes,
    default_deposit_percent: v.defaultDepositPercent,
    hold_minutes: v.holdMinutes,
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
