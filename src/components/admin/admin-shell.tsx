"use client";

import { LogOutIcon, MenuIcon } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { adminNav } from "@/components/admin/admin-nav";
import { Sparkle } from "@/components/shared/sparkle";
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
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar md:flex print:hidden">
        <SidebarContent admin={admin} pillId="admin-nav-pill" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background/80 px-4 py-2 backdrop-blur print:hidden">
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
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Admin navigation</SheetTitle>
              </SheetHeader>
              <SidebarContent
                admin={admin}
                pillId="admin-nav-pill-sheet"
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <span className="md:hidden">
            <BrandMark />
          </span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="flex-1 p-4 md:p-10 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  admin,
  pillId,
  onNavigate,
}: {
  admin: ShellAdmin;
  /** Unique per rendered sidebar, so the desktop and phone menus each slide their own pill. */
  pillId: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-6">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="inline-block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <BrandMark />
        </Link>
      </div>
      <MotionConfig reducedMotion="user">
        <nav aria-label="Admin" className="flex-1 space-y-1 px-3">
          {adminNav.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active &&
                    "text-sidebar-primary-foreground hover:bg-transparent hover:text-sidebar-primary-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId={pillId}
                    className="absolute inset-0 rounded-full bg-sidebar-primary shadow-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    aria-hidden
                  />
                )}
                <Icon
                  className="relative size-4 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"
                  aria-hidden
                />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>
      </MotionConfig>
      <div className="m-3 rounded-2xl border bg-card p-3">
        <p className="truncate px-1 text-sm font-semibold">{admin.fullName ?? "Admin"}</p>
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

/** The studio logo (on white, so it reads in dark mode too) with an "admin" tag. */
function BrandMark() {
  return (
    <span className="flex items-center gap-3">
      <span className="relative shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5">
        <Image
          src="/brand/logo.jpg"
          alt="Light Chasers Studio"
          width={56}
          height={56}
          sizes="56px"
          priority
        />
      </span>
      <span className="flex items-center gap-1.5 font-script text-lg text-terracotta-ink">
        <Sparkle className="size-3 text-terracotta" />
        studio admin
      </span>
    </span>
  );
}
