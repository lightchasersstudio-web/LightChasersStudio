"use server";

import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { addOnIdSchema, addOnSchema, setAddOnActiveSchema } from "@/lib/validations/add-ons";
import { reorderSchema } from "@/lib/validations/services";
import { adminAction, audit, revalidate, TAGS } from "@/server/admin-action";

export async function createAddOn(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction(addOnSchema, input, async (row, ctx) => {
    // New add-ons go to the end of the list.
    const { data: last } = await ctx.supabase
      .from("add_ons")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await ctx.supabase
      .from("add_ons")
      .insert({ ...row, sort_order: (last?.sort_order ?? -1) + 1 })
      .select("id")
      .single();
    if (error) throw error;

    await audit(ctx, "add_on.create", "add_on", data.id, { name: row.name });
    revalidate(TAGS.addOns);
    return ok({ id: data.id });
  });
}

export async function updateAddOn(id: string, input: unknown): Promise<ActionResult> {
  return adminAction(addOnSchema, input, async (row, ctx) => {
    if (!addOnIdSchema.safeParse({ id }).success) return fail("Add-on not found.");
    const { data, error } = await ctx.supabase
      .from("add_ons")
      .update(row)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Add-on not found.");

    await audit(ctx, "add_on.update", "add_on", id, { name: row.name, price: row.price_cents });
    revalidate(TAGS.addOns);
    return ok(undefined);
  });
}

export async function setAddOnActive(input: unknown): Promise<ActionResult> {
  return adminAction(setAddOnActiveSchema, input, async ({ id, isActive }, ctx) => {
    const { error } = await ctx.supabase
      .from("add_ons")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) throw error;
    await audit(ctx, isActive ? "add_on.activate" : "add_on.deactivate", "add_on", id);
    revalidate(TAGS.addOns);
    return ok(undefined);
  });
}

/** Past bookings keep their own copy of the add-on's name and price. */
export async function deleteAddOn(input: unknown): Promise<ActionResult> {
  return adminAction(addOnIdSchema, input, async ({ id }, ctx) => {
    const { data, error } = await ctx.supabase
      .from("add_ons")
      .delete()
      .eq("id", id)
      .select("name")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Add-on not found.");

    await audit(ctx, "add_on.delete", "add_on", id, { name: data.name });
    revalidate(TAGS.addOns);
    return ok(undefined);
  });
}

export async function reorderAddOns(input: unknown): Promise<ActionResult> {
  return adminAction(reorderSchema, input, async ({ ids }, ctx) => {
    const results = await Promise.all(
      ids.map((id, index) =>
        ctx.supabase.from("add_ons").update({ sort_order: index }).eq("id", id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    revalidate(TAGS.addOns);
    return ok(undefined);
  });
}
