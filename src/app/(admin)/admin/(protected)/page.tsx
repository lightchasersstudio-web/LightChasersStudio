import type { Metadata } from "next";

import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome back{admin.fullName ? `, ${admin.fullName}` : ""}. Bookings and stats arrive in
        Phase 6.
      </p>
    </section>
  );
}
