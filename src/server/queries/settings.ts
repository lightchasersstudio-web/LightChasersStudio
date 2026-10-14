import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type BusinessSettings = Tables<"business_settings">;

export async function getBusinessSettingsForAdmin(): Promise<BusinessSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("business_settings").select("*").single();
  if (error) throw error;
  return data;
}
