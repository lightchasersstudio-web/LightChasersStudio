"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, type ActionResult } from "@/lib/utils/action-result";
import {
  reorderSchema,
  serviceIdSchema,
  serviceSchema,
  setServiceActiveSchema,
} from "@/lib/validations/services";
import { adminAction, audit, PG, revalidate, TAGS } from "@/server/admin-action";
import { notifyBookingUpdated } from "@/server/booking-notifications";
import { loadBookingRecord } from "@/server/queries/booking-record";
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
      .select("cover_image_path, workshop_starts_at, workshop_ends_at, workshop_location")
      .eq("id", id)
      .maybeSingle();
    if (!before) return fail("Service not found.");

    const { error } = await ctx.supabase.from("services").update(row).eq("id", id);
    if (error?.code === PG.unique) return slugTaken();
    if (error) throw error;

    if (before.cover_image_path && before.cover_image_path !== row.cover_image_path) {
      await removeObjects(ctx.supabase, "portfolio", [before.cover_image_path]);
    }
    // A trigger has moved the workshop's sign-ups; tell them if the admin wants that.
    const same = (a: string | null, b: string | null) =>
      a === b || (a !== null && b !== null && Date.parse(a) === Date.parse(b));
    const moved =
      row.category === "workshop" &&
      row.workshop_starts_at !== null &&
      (!same(before.workshop_starts_at, row.workshop_starts_at) ||
        !same(before.workshop_ends_at, row.workshop_ends_at) ||
        before.workshop_location !== row.workshop_location);
    const emailed =
      moved && notifySchema.parse(input).notifyWorkshopMove ? await emailWorkshopMove(id) : 0;
    await audit(ctx, "service.update", "service", id, {
      name: row.name,
      ...(moved ? { workshop_moved: true, emailed } : {}),
    });
    revalidate(TAGS.services, TAGS.portfolio); // photos show the package name and link
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
    revalidate(TAGS.services, TAGS.portfolio);
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
    revalidate(TAGS.services, TAGS.portfolio);
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

const notifySchema = z.object({ notifyWorkshopMove: z.boolean().catch(true) });

/** Emails the updated booking to everyone signed up for this workshop who still is. */
async function emailWorkshopMove(serviceId: string): Promise<number> {
  const { data, error } = await createAdminClient()
    .from("bookings")
    .select("id")
    .eq("service_id", serviceId)
    .in("status", ["pending", "confirmed"]);
  if (error) throw error;
  const results = await Promise.allSettled(
    data.map(async ({ id }) => {
      const record = await loadBookingRecord({ id });
      if (!record?.email) return false;
      await notifyBookingUpdated(record);
      return true;
    }),
  );
  for (const r of results) if (r.status === "rejected") console.error("[workshop move]", r.reason);
  return results.filter((r) => r.status === "fulfilled" && r.value).length;
}
