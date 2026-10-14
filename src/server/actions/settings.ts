"use server";

import { ok, fail, type ActionResult } from "@/lib/utils/action-result";
import { bookingRulesSchema, logoSchema, studioProfileSchema } from "@/lib/validations/settings";
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
