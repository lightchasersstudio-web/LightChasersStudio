import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type AdminRole = "owner" | "admin";

export type CurrentAdmin = {
  userId: string;
  email: string | null;
  role: AdminRole;
  fullName: string | null;
};

type AdminLookup =
  { status: "signed-out" } | { status: "forbidden" } | { status: "admin"; admin: CurrentAdmin };

/**
 * Verifies the session JWT (getClaims) and looks up the admin_profiles row.
 * Memoised per render pass; server actions call it fresh each time.
 */
const lookupAdmin = cache(async (): Promise<AdminLookup> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return { status: "signed-out" };

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("role, full_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return { status: "forbidden" };

  return {
    status: "admin",
    admin: {
      userId,
      email: typeof data.claims.email === "string" ? data.claims.email : null,
      role: profile.role as AdminRole,
      fullName: profile.full_name as string | null,
    },
  };
});

/** For admin pages/layouts: returns the admin or redirects. Call inside <Suspense>. */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const result = await lookupAdmin();
  if (result.status === "signed-out") redirect("/admin/login");
  if (result.status === "forbidden") redirect("/admin/login?error=forbidden");
  return result.admin;
}

/** For server actions / route handlers: returns the admin or null (never redirects). */
export async function assertAdmin(): Promise<CurrentAdmin | null> {
  const result = await lookupAdmin();
  return result.status === "admin" ? result.admin : null;
}
