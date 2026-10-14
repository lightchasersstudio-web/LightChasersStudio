import type { Metadata } from "next";

import { Sparkle } from "@/components/shared/sparkle";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();

  return (
    <section className="relative overflow-hidden rounded-3xl border bg-accent/60 p-6 md:p-10">
      <Sparkle className="absolute top-6 right-8 size-6 text-terracotta" />
      <Sparkle className="absolute top-14 right-16 size-3 text-sage" />
      <p className="font-script text-2xl text-terracotta-ink">hello again,</p>
      <h1 className="mt-1 text-3xl font-semibold md:text-4xl">
        {admin.fullName ?? "Welcome back"}
      </h1>
      <p className="mt-3 max-w-prose text-muted-foreground">
        This is your studio dashboard. Upcoming sessions, new requests and stats will show up here
        once bookings go live.
      </p>
    </section>
  );
}
