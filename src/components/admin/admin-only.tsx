import { requireAdmin } from "@/server/auth";

/** Renders children only for admins. Use inside <Suspense> on pages with no data of their own. */
export async function AdminOnly({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
