"use server";

import { ok, fail, type ActionResult } from "@/lib/utils/action-result";
import {
  addPortfolioImagesSchema,
  portfolioIdSchema,
  updatePortfolioImageSchema,
} from "@/lib/validations/portfolio";
import { reorderSchema } from "@/lib/validations/services";
import { adminAction, audit, revalidate, TAGS } from "@/server/admin-action";
import { removeObjects } from "@/server/storage";

/** Records images the browser already uploaded to the `portfolio` bucket. */
export async function addPortfolioImages(input: unknown): Promise<ActionResult<{ added: number }>> {
  return adminAction(addPortfolioImagesSchema, input, async ({ images }, ctx) => {
    // New uploads go to the top of the gallery.
    const { data: first } = await ctx.supabase
      .from("portfolio_images")
      .select("sort_order")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    const start = (first?.sort_order ?? 0) - images.length;

    const { data, error } = await ctx.supabase
      .from("portfolio_images")
      .insert(
        images.map((img, i) => ({
          storage_path: img.storagePath,
          category: img.category,
          alt_text: img.altText,
          width: img.width,
          height: img.height,
          blur_data_url: img.blurDataUrl,
          sort_order: start + i,
        })),
      )
      .select("id");
    if (error) throw error;

    await audit(ctx, "portfolio.add", "portfolio_images", null, { count: data.length });
    revalidate(TAGS.portfolio);
    return ok({ added: data.length });
  });
}

export async function updatePortfolioImage(input: unknown): Promise<ActionResult> {
  return adminAction(updatePortfolioImageSchema, input, async (v, ctx) => {
    const { data, error } = await ctx.supabase
      .from("portfolio_images")
      .update({
        category: v.category,
        alt_text: v.altText,
        caption: v.caption,
        is_featured: v.isFeatured,
      })
      .eq("id", v.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Photo not found.");
    revalidate(TAGS.portfolio);
    return ok(undefined);
  });
}

export async function deletePortfolioImage(input: unknown): Promise<ActionResult> {
  return adminAction(portfolioIdSchema, input, async ({ id }, ctx) => {
    const { data, error } = await ctx.supabase
      .from("portfolio_images")
      .delete()
      .eq("id", id)
      .select("storage_path")
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("Photo not found.");

    await removeObjects(ctx.supabase, "portfolio", [data.storage_path]);
    await audit(ctx, "portfolio.delete", "portfolio_images", id, { path: data.storage_path });
    revalidate(TAGS.portfolio);
    return ok(undefined);
  });
}

export async function reorderPortfolio(input: unknown): Promise<ActionResult> {
  return adminAction(reorderSchema, input, async ({ ids }, ctx) => {
    const results = await Promise.all(
      ids.map((id, index) =>
        ctx.supabase.from("portfolio_images").update({ sort_order: index }).eq("id", id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    revalidate(TAGS.portfolio);
    return ok(undefined);
  });
}
