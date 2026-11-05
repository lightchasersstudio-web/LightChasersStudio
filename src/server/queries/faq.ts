import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type Faq = Tables<"faqs">;

/** Admin list: every question, hidden ones too (RLS lets admins see them). */
export async function listFaqsForAdmin(): Promise<Faq[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return data;
}
