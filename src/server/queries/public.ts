import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { TAGS } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/types/database.types";

// Public catalogue reads. Cached and tagged; admin actions expire the tags via
// updateTag(), so edits show up on the next request. cacheLife("days") is only
// a safety net in case an invalidation is ever missed.

export type PublicService = Tables<"services">;
/** A portfolio photo, with the package it shows when linked (null if unlinked or hidden). */
export type PublicPhoto = Tables<"portfolio_images"> & {
  service: Pick<Tables<"services">, "slug" | "name"> | null;
};
export type PublicSettings = Pick<
  Tables<"business_settings">,
  | "business_name"
  | "tagline"
  | "about"
  | "logo_path"
  | "email"
  | "phone"
  | "address"
  | "city"
  | "facebook_url"
  | "instagram_url"
  | "tiktok_url"
  | "default_deposit_percent"
  | "hold_minutes"
  | "max_advance_days"
>;

export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("days");
  const { data, error } = await createPublicClient()
    .from("business_settings")
    .select(
      "business_name, tagline, about, logo_path, email, phone, address, city, facebook_url, instagram_url, tiktok_url, default_deposit_percent, hold_minutes, max_advance_days",
    )
    .single();
  if (error) throw error;
  return data;
}

export async function listActiveServices(): Promise<PublicService[]> {
  "use cache";
  cacheTag(TAGS.services);
  cacheLife("days");
  const { data, error } = await createPublicClient()
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function getActiveServiceBySlug(slug: string): Promise<PublicService | null> {
  "use cache";
  cacheTag(TAGS.services);
  cacheLife("days");
  const { data, error } = await createPublicClient()
    .from("services")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPortfolio(): Promise<PublicPhoto[]> {
  "use cache";
  cacheTag(TAGS.portfolio);
  cacheLife("days");
  const { data, error } = await createPublicClient()
    .from("portfolio_images")
    // RLS only exposes active services to anon, so a hidden package joins as null.
    .select("*, service:services(slug, name)")
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listFeaturedPhotos(limit: number): Promise<PublicPhoto[]> {
  "use cache";
  cacheTag(TAGS.portfolio);
  cacheLife("days");
  const { data, error } = await createPublicClient()
    .from("portfolio_images")
    // RLS only exposes active services to anon, so a hidden package joins as null.
    .select("*, service:services(slug, name)")
    .eq("is_featured", true)
    .order("sort_order")
    .limit(limit);
  if (error) throw error;
  return data;
}

export type OpeningHours = { day: number; windows: { start: string; end: string }[] }[];

export async function getOpeningHours(): Promise<OpeningHours> {
  "use cache";
  cacheTag(TAGS.availability);
  cacheLife("days");
  const { data, error } = await createPublicClient()
    .from("availability_rules")
    .select("day_of_week, start_time, end_time")
    .order("day_of_week")
    .order("start_time");
  if (error) throw error;
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    day,
    windows: data
      .filter((r) => r.day_of_week === day)
      .map((r) => ({ start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) })),
  }));
}

/** For the footer's © line; cached so pages stay prerenderable. */
export async function currentYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}
