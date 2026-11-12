"use server";

import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { faqIdSchema, faqSchema, setFaqPublishedSchema } from "@/lib/validations/faq";
import { reorderSchema } from "@/lib/validations/services";
import { adminAction, audit, revalidate, TAGS } from "@/server/admin-action";

export async function createFaq(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminAction(faqSchema, input, async (row, ctx) => {
    // New questions go to the end of the list.
    const { data: last } = await ctx.supabase
      .from("faqs")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await ctx.supabase
      .from("faqs")
      .insert({ ...row, sort_order: (last?.sort_order ?? -1) + 1 })
      .select("id")
      .single();
    if (error) throw error;
    await audit(ctx, "faq.create", "faq", data.id, { question: row.question });
    revalidate(TAGS.faq);
    return ok({ id: data.id });
  });
}

export async function updateFaq(id: string, input: unknown): Promise<ActionResult> {
  return adminAction(faqSchema, input, async (row, ctx) => {
    if (!faqIdSchema.safeParse({ id }).success) return fail("Question not found.");
    const { data, error } = await ctx.supabase
      .from("faqs")
      .update(row)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Question not found.");
    await audit(ctx, "faq.update", "faq", id, { question: row.question });
    revalidate(TAGS.faq);
    return ok(undefined);
  });
}

export async function setFaqPublished(input: unknown): Promise<ActionResult> {
  return adminAction(setFaqPublishedSchema, input, async ({ id, isPublished }, ctx) => {
    const { error } = await ctx.supabase
      .from("faqs")
      .update({ is_published: isPublished })
      .eq("id", id);
    if (error) throw error;
    await audit(ctx, isPublished ? "faq.publish" : "faq.hide", "faq", id);
    revalidate(TAGS.faq);
    return ok(undefined);
  });
}

export async function deleteFaq(input: unknown): Promise<ActionResult> {
  return adminAction(faqIdSchema, input, async ({ id }, ctx) => {
    const { data, error } = await ctx.supabase
      .from("faqs")
      .delete()
      .eq("id", id)
      .select("question")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Question not found.");
    await audit(ctx, "faq.delete", "faq", id, { question: data.question });
    revalidate(TAGS.faq);
    return ok(undefined);
  });
}

/** The whole list in its new order (topics stay grouped on the page). */
export async function reorderFaqs(input: unknown): Promise<ActionResult> {
  return adminAction(reorderSchema, input, async ({ ids }, ctx) => {
    const results = await Promise.all(
      ids.map((id, index) => ctx.supabase.from("faqs").update({ sort_order: index }).eq("id", id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    revalidate(TAGS.faq);
    return ok(undefined);
  });
}
