import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type PortfolioImage = Tables<"portfolio_images">;

export async function listPortfolioForAdmin(): Promise<PortfolioImage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolio_images")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
