import "server-only";

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

export type EmployeeStatusFilter = "active" | "inactive";

/** Active (or inactive) staff, A–Z, with photo links. Callers check requireAdmin(). */
export async function listEmployees(status: EmployeeStatusFilter): Promise<EmployeeWithPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("is_active", status === "active")
    .order("full_name");
  if (error) throw error;
  const urls = await photoUrls(data.flatMap((e) => (e.photo_path ? [e.photo_path] : [])));
  return data.map((e) => ({
    ...e,
    photoUrl: e.photo_path ? (urls.get(e.photo_path) ?? null) : null,
  }));
}

export async function countEmployees(): Promise<{ active: number; inactive: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees").select("is_active");
  if (error) throw error;
  const active = data.filter((e) => e.is_active).length;
  return { active, inactive: data.length - active };
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

/** Working days in a month (Payroll settings), for daily ↔ monthly rates. */
export async function getWorkDaysPerMonth(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contribution_settings")
    .select("work_days_per_month")
    .single();
  if (error) throw error;
  return Number(data.work_days_per_month);
}
