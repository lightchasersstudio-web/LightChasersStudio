"use client";

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
    <ul className="hidden items-center gap-1 md:flex">
      {SITE_NAV.map(({ href, label }) => {
        const active = isActive(href, pathname);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors duration-200 hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active && "text-terracotta-ink",
              )}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
