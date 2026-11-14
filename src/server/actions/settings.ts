"use server";

import { ok, fail, type ActionResult } from "@/lib/utils/action-result";
import {
  bookingRulesSchema,
  chargePricesSchema,
  logoSchema,
  studioPolicySchema,
  studioProfileSchema,
} from "@/lib/validations/settings";
import { adminAction, audit, revalidate, TAGS } from "@/server/admin-action";
import { removeObjects } from "@/server/storage";

export async function saveStudioProfile(input: unknown): Promise<ActionResult> {
  return adminAction(studioProfileSchema, input, async (row, ctx) => {
    const { error } = await ctx.supabase.from("business_settings").update(row).eq("id", true);
    if (error) throw error;
    await audit(ctx, "settings.profile", "business_settings", null);
    revalidate(TAGS.settings);
    return ok(undefined);
  });
}

export async function saveBookingRules(input: unknown): Promise<ActionResult> {
  return adminAction(bookingRulesSchema, input, async (row, ctx) => {
    const { error } = await ctx.supabase.from("business_settings").update(row).eq("id", true);
    if (error) throw error;
    await audit(ctx, "settings.booking_rules", "business_settings", null, row);
    // Rules change which slots are bookable.
    revalidate(TAGS.settings, TAGS.availability);
    return ok(undefined);
  });
}

export async function saveLogo(input: unknown): Promise<ActionResult> {
  return adminAction(logoSchema, input, async ({ logoPath }, ctx) => {
    const { data: before, error: readError } = await ctx.supabase
      .from("business_settings")
      .select("logo_path")
      .single();
    if (readError) throw readError;

    const { error } = await ctx.supabase
      .from("business_settings")
      .update({ logo_path: logoPath })
      .eq("id", true);
    if (error) return fail("Couldn't save the logo. Please try again.");

    if (before.logo_path && before.logo_path !== logoPath) {
      await removeObjects(ctx.supabase, "brand", [before.logo_path]);
    }
    await audit(
      ctx,
      logoPath ? "settings.logo" : "settings.logo_remove",
      "business_settings",
      null,
    );
    revalidate(TAGS.settings);
    return ok(undefined);
  });
}

/** The Studio Policy Manual wording; bookings keep the copy they agreed to. */
export async function saveStudioPolicy(input: unknown): Promise<ActionResult> {
  return adminAction(studioPolicySchema, input, async (row, ctx) => {
    const { error } = await ctx.supabase.from("business_settings").update(row).eq("id", true);
    if (error) throw error;
    await audit(ctx, "settings.studio_policy", "business_settings", null, {
      characters: row.studio_policy.length,
    });
    revalidate(TAGS.settings);
    return ok(undefined);
  });
}

/** Preset prices for extra charges after a shoot. */
export async function saveChargePrices(input: unknown): Promise<ActionResult> {
  return adminAction(chargePricesSchema, input, async (row, ctx) => {
    const { error } = await ctx.supabase.from("business_settings").update(row).eq("id", true);
    if (error) throw error;
    await audit(ctx, "settings.charge_prices", "business_settings", null, row);
    revalidate(TAGS.settings);
    return ok(undefined);
  });
}
