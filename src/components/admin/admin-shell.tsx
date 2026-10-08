"use client";

import { LogOutIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { adminNav } from "@/components/admin/admin-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { signOut } from "@/server/actions/auth";

type ShellAdmin = { email: string | null; fullName: string | null };

export function AdminShell({ admin, children }: { admin: ShellAdmin; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r md:flex">
        <SidebarContent admin={admin} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-4 py-2">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation"
              >
                <MenuIcon className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Admin navigation</SheetTitle>
              </SheetHeader>
              <SidebarContent admin={admin} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-medium md:hidden">Light Chasers · Admin</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ admin, onNavigate }: { admin: ShellAdmin; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-4">
        <Link href="/admin" className="font-semibold" onClick={onNavigate}>
          Light Chasers · Admin
        </Link>
      </div>
      <nav aria-label="Admin" className="flex-1 space-y-1 p-2">
        {adminNav.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active && "bg-muted font-medium",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <p className="truncate px-1 text-sm font-medium">{admin.fullName ?? "Admin"}</p>
        {admin.email && (
          <p className="truncate px-1 text-xs text-muted-foreground">{admin.email}</p>
        )}
        <form action={signOut} className="mt-2">
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
            <LogOutIcon aria-hidden />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
