import "server-only";

import { ratesFromRow, type ContributionRates } from "@/lib/payroll/contributions";
import type { EmployeeCategory } from "@/lib/payroll/employees";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type Employee = Tables<"employees">;
export type EmployeeBenefits = Tables<"employee_benefits">;
export type EmployeeWithPhoto = Employee & { photoUrl: string | null };

/** Staff photos live in a private bucket: short-lived links for admins (RLS). */
const PHOTO_LINK_SECONDS = 60 * 60;

async function photoUrls(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (!paths.length) return urls;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("employee-photos")
    .createSignedUrls(paths, PHOTO_LINK_SECONDS);
  for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  return urls;
}

/** "deleted" = Employees → Deleted (history only). */
export type EmployeeStatusFilter = "active" | "inactive" | "deleted";
/** A category, "none" (not set yet) or null (all). */
export type EmployeeCategoryFilter = EmployeeCategory | "none" | null;

/** Active (or inactive) staff, A–Z, with photo links. Callers check requireAdmin(). */
export async function listEmployees(
  status: EmployeeStatusFilter,
  category: EmployeeCategoryFilter = null,
): Promise<EmployeeWithPhoto[]> {
  const supabase = await createClient();
  let query = supabase.from("employees").select("*");
  query =
    status === "deleted"
      ? query.not("deleted_at", "is", null).order("deleted_at", { ascending: false })
      : query
          .is("deleted_at", null)
          .eq("is_active", status === "active")
          .order("full_name");
  if (category === "none") query = query.is("category", null);
  else if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw error;
  const urls = await photoUrls(data.flatMap((e) => (e.photo_path ? [e.photo_path] : [])));
  return data.map((e) => ({
    ...e,
    photoUrl: e.photo_path ? (urls.get(e.photo_path) ?? null) : null,
  }));
}

export async function countEmployees(): Promise<{
  active: number;
  inactive: number;
  deleted: number;
  /** Active staff with no category yet. */
  uncategorized: number;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("is_active, category, deleted_at");
  if (error) throw error;
  const kept = data.filter((e) => !e.deleted_at);
  const active = kept.filter((e) => e.is_active).length;
  return {
    active,
    inactive: kept.length - active,
    deleted: data.length - kept.length,
    uncategorized: kept.filter((e) => e.is_active && !e.category).length,
  };
}

export type EmployeeDetail = EmployeeWithPhoto & { benefits: EmployeeBenefits | null };

export async function getEmployee(id: string): Promise<EmployeeDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*, benefits:employee_benefits(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { benefits, ...employee } = data;
  const urls = await photoUrls(employee.photo_path ? [employee.photo_path] : []);
  return {
    ...employee,
    benefits,
    photoUrl: employee.photo_path ? (urls.get(employee.photo_path) ?? null) : null,
  };
}

/** Active (or inactive) staff with their benefits, A–Z, for the staff details PDF. */
export async function listEmployeeDetails(status: EmployeeStatusFilter): Promise<EmployeeDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*, benefits:employee_benefits(*)")
    .is("deleted_at", null)
    .eq("is_active", status === "active")
    .order("full_name");
  if (error) throw error;
  return data.map(({ benefits, ...e }) => ({ ...e, benefits, photoUrl: null }));
}

/** Contribution rates and working days per month (Payroll → Payroll settings). */
export async function getContributionRates(): Promise<ContributionRates> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("contribution_settings").select("*").single();
  if (error) throw error;
  return ratesFromRow(data);
}
