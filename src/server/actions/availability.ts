"use server";

import { ok, fail, type ActionResult } from "@/lib/utils/action-result";
import { businessToday } from "@/lib/utils/business-date";
import {
  blackoutIdSchema,
  blackoutSchema,
  weeklyHoursSchema,
} from "@/lib/validations/availability";
import { adminAction, audit, revalidate, TAGS } from "@/server/admin-action";

export async function saveWeeklyHours(input: unknown): Promise<ActionResult> {
  return adminAction(weeklyHoursSchema, input, async (rules, ctx) => {
    // One RPC = one transaction, so the public slot picker never sees a half-saved week.
    const { error } = await ctx.supabase.rpc("replace_availability_rules", { p_rules: rules });
    if (error) throw error;
    await audit(ctx, "availability.update", "availability_rules", null, { windows: rules.length });
    revalidate(TAGS.availability);
    return ok(undefined);
  });
}

export async function addBlackoutDates(input: unknown): Promise<ActionResult<{ added: number }>> {
  // "today" always comes from the server clock, never from the browser.
  const withToday = { ...(input as object), today: businessToday() };
  return adminAction(blackoutSchema, withToday, async ({ dates, reason }, ctx) => {
    // Dates already blocked are skipped rather than failing the whole range.
    const { data, error } = await ctx.supabase
      .from("blackout_dates")
      .upsert(
        dates.map((date) => ({ date, reason })),
        { onConflict: "date", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw error;
    if (data.length === 0) return fail("Those dates are already blocked.");

    await audit(ctx, "blackout.add", "blackout_dates", null, { dates, reason });
    revalidate(TAGS.availability);
    return ok({ added: data.length });
  });
}

export async function removeBlackoutDate(input: unknown): Promise<ActionResult> {
  return adminAction(blackoutIdSchema, input, async ({ id }, ctx) => {
    const { data, error } = await ctx.supabase
      .from("blackout_dates")
      .delete()
      .eq("id", id)
      .select("date")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("That date was already removed.");
    await audit(ctx, "blackout.remove", "blackout_dates", id, { date: data.date });
    revalidate(TAGS.availability);
    return ok(undefined);
  });
}
