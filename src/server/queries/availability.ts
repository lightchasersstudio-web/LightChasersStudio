import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type AvailabilityRule = Tables<"availability_rules">;
export type BlackoutDate = Tables<"blackout_dates">;

export async function listAvailabilityRules(): Promise<AvailabilityRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_rules")
    .select("*")
    .order("day_of_week")
    .order("start_time");
  if (error) throw error;
  return data;
}

/** Blackouts from `fromDate` (business-local YYYY-MM-DD) onwards. */
export async function listUpcomingBlackouts(fromDate: string): Promise<BlackoutDate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blackout_dates")
    .select("*")
    .gte("date", fromDate)
    .order("date");
  if (error) throw error;
  return data;
}
