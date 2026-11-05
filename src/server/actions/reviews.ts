"use server";

import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { reviewIdSchema, reviewSchema, setReviewPublishedSchema } from "@/lib/validations/reviews";
import { reorderSchema } from "@/lib/validations/services";
import { adminAction, audit, revalidate, TAGS } from "@/server/admin-action";

export async function createReview(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction(reviewSchema, input, async (row, ctx) => {
    // New reviews go to the end of the list.
    const { data: last } = await ctx.supabase
      .from("reviews")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await ctx.supabase
      .from("reviews")
      .insert({ ...row, sort_order: (last?.sort_order ?? -1) + 1 })
      .select("id")
      .single();
    if (error) throw error;

    await audit(ctx, "review.create", "review", data.id, { name: row.name });
    revalidate(TAGS.reviews);
    return ok({ id: data.id });
  });
}

export async function updateReview(id: string, input: unknown): Promise<ActionResult> {
  return adminAction(reviewSchema, input, async (row, ctx) => {
    if (!reviewIdSchema.safeParse({ id }).success) return fail("Review not found.");
    const { data, error } = await ctx.supabase
      .from("reviews")
      .update(row)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Review not found.");

    await audit(ctx, "review.update", "review", id, { name: row.name });
    revalidate(TAGS.reviews);
    return ok(undefined);
  });
}

export async function setReviewPublished(input: unknown): Promise<ActionResult> {
  return adminAction(setReviewPublishedSchema, input, async ({ id, isPublished }, ctx) => {
    const { error } = await ctx.supabase
      .from("reviews")
      .update({ is_published: isPublished })
      .eq("id", id);
    if (error) throw error;
    await audit(ctx, isPublished ? "review.publish" : "review.hide", "review", id);
    revalidate(TAGS.reviews);
    return ok(undefined);
  });
}

export async function deleteReview(input: unknown): Promise<ActionResult> {
  return adminAction(reviewIdSchema, input, async ({ id }, ctx) => {
    const { data, error } = await ctx.supabase
      .from("reviews")
      .delete()
      .eq("id", id)
      .select("name")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Review not found.");

    await audit(ctx, "review.delete", "review", id, { name: data.name });
    revalidate(TAGS.reviews);
    return ok(undefined);
  });
}

export async function reorderReviews(input: unknown): Promise<ActionResult> {
  return adminAction(reorderSchema, input, async ({ ids }, ctx) => {
    const results = await Promise.all(
      ids.map((id, index) =>
        ctx.supabase.from("reviews").update({ sort_order: index }).eq("id", id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    revalidate(TAGS.reviews);
    return ok(undefined);
  });
}
