import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type Review = Tables<"reviews">;

/** Admin list: every review (RLS lets admins see hidden ones too). */
export async function listReviewsForAdmin(): Promise<Review[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return data;
}
