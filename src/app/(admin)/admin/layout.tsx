import type { Metadata } from "next";

import { ThemeToggle } from "@/components/shared/theme-toggle";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Placeholder admin shell. Auth (proxy.ts + server-side checks) and navigation arrive in Phase 2.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-medium">Light Chasers · Admin</span>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" className="flex-1 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
