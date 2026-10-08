import { Suspense } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/server/auth";

/**
 * Everything under here requires an admin. The check runs inside <Suspense>
 * (Cache Components: session cookies are runtime data), and children render
 * only after it passes, so protected content never streams to non-admins.
 * Pages and server actions still re-check (layouts don't re-run on navigation).
 */
export default function ProtectedAdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <AdminShell admin={{ email: admin.email, fullName: admin.fullName }}>{children}</AdminShell>
  );
}

function AdminShellSkeleton() {
  return (
    <div className="flex flex-1" aria-busy="true" aria-label="Loading admin">
      <div className="hidden w-60 border-r p-4 md:block">
        <Skeleton className="mb-6 h-8 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-4 md:p-8">
        <Skeleton className="h-8 w-48" />
      </div>
    </div>
  );
}
