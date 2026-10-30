"use client";

import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { SITE_NAV } from "@/components/public/site-nav";
import { cn } from "@/lib/utils";

/**
 * Desktop nav with the current page marked. usePathname() is request data under
 * Cache Components, so it sits behind <Suspense>; the fallback is the same
 * links without the highlight (needed for pages rendered on demand).
 */
export function NavLinks() {
  return (
    <Suspense fallback={<Links pathname={null} />}>
      <ActiveNavLinks />
    </Suspense>
  );
}

function ActiveNavLinks() {
  return <Links pathname={usePathname()} />;
}

function Links({ pathname }: { pathname: string | null }) {
  return (
    <MotionConfig reducedMotion="user">
      {/* A segmented track: the current page sits on a raised pill that slides between links. */}
      <ul className="hidden items-center gap-0.5 rounded-full bg-muted/70 p-1 lg:flex dark:bg-muted/50">
        {SITE_NAV.map(({ href, label }) => {
          const active = isActive(href, pathname);
          return (
            <li key={href} className="relative">
              {/* One shared pill that slides to the current page. */}
              {active && (
                <motion.span
                  layoutId="site-nav-pill"
                  className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-border/60"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  aria-hidden
                />
              )}
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active && "text-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </MotionConfig>
  );
}

export function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
