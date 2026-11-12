import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type AddOn = Tables<"add_ons">;

/** Admin list: every add-on (RLS lets admins see hidden ones too). */
export async function listAddOnsForAdmin(): Promise<AddOn[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("add_ons")
    .select("*")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return data;
}
