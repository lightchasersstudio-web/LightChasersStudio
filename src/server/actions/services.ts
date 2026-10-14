"use server";

import { ok, fail, type ActionResult } from "@/lib/utils/action-result";
import {
  reorderSchema,
  serviceIdSchema,
  serviceSchema,
  setServiceActiveSchema,
} from "@/lib/validations/services";
import { adminAction, audit, PG, revalidate, TAGS } from "@/server/admin-action";
import { removeObjects } from "@/server/storage";

export async function createService(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction(serviceSchema, input, async (row, ctx) => {
    // New services go to the end of the list.
    const { data: last } = await ctx.supabase
      .from("services")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await ctx.supabase
      .from("services")
      .insert({ ...row, sort_order: (last?.sort_order ?? -1) + 1 })
      .select("id")
      .single();
    if (error?.code === PG.unique) return slugTaken();
    if (error) throw error;

    await audit(ctx, "service.create", "service", data.id, { name: row.name });
    revalidate(TAGS.services);
    return ok({ id: data.id });
  });
}

export async function updateService(id: string, input: unknown): Promise<ActionResult> {
  return adminAction(serviceSchema, input, async (row, ctx) => {
    if (!serviceIdSchema.safeParse({ id }).success) return fail("Service not found.");

    const { data: before } = await ctx.supabase
      .from("services")
      .select("cover_image_path")
      .eq("id", id)
      .maybeSingle();
    if (!before) return fail("Service not found.");

    const { error } = await ctx.supabase.from("services").update(row).eq("id", id);
    if (error?.code === PG.unique) return slugTaken();
    if (error) throw error;

    if (before.cover_image_path && before.cover_image_path !== row.cover_image_path) {
      await removeObjects(ctx.supabase, "portfolio", [before.cover_image_path]);
    }
    await audit(ctx, "service.update", "service", id, { name: row.name });
    revalidate(TAGS.services);
    return ok(undefined);
  });
}

export async function setServiceActive(input: unknown): Promise<ActionResult> {
  return adminAction(setServiceActiveSchema, input, async ({ id, isActive }, ctx) => {
    const { error } = await ctx.supabase
      .from("services")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) throw error;
    await audit(ctx, isActive ? "service.activate" : "service.deactivate", "service", id);
    revalidate(TAGS.services);
    return ok(undefined);
  });
}

export async function deleteService(input: unknown): Promise<ActionResult> {
  return adminAction(serviceIdSchema, input, async ({ id }, ctx) => {
    const { data, error } = await ctx.supabase
      .from("services")
      .delete()
      .eq("id", id)
      .select("name, cover_image_path")
      .maybeSingle();
    if (error?.code === PG.foreignKey) {
      return fail(
        "This service has bookings, so it can't be deleted. Turn it off instead to hide it from clients.",
      );
    }
    if (error) throw error;
    if (!data) return fail("Service not found.");

    if (data.cover_image_path)
      await removeObjects(ctx.supabase, "portfolio", [data.cover_image_path]);
    await audit(ctx, "service.delete", "service", id, { name: data.name });
    revalidate(TAGS.services);
    return ok(undefined);
  });
}

export async function reorderServices(input: unknown): Promise<ActionResult> {
  return adminAction(reorderSchema, input, async ({ ids }, ctx) => {
    const results = await Promise.all(
      ids.map((id, index) =>
        ctx.supabase.from("services").update({ sort_order: index }).eq("id", id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    revalidate(TAGS.services);
    return ok(undefined);
  });
}

function slugTaken() {
  return fail("Please check the highlighted fields.", {
    slug: ["Another service already uses this URL name."],
  });
}
