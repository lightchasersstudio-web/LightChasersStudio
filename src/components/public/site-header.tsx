import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";

import { BrandLockup } from "@/components/public/brand-lockup";
import { HeaderFrame } from "@/components/public/header-frame";
import { MobileNav } from "@/components/public/mobile-nav";
import { NavLinks } from "@/components/public/nav-links";
import { BOOK_HREF } from "@/components/public/site-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { getPublicSettings } from "@/server/queries/public";

export async function SiteHeader() {
  const settings = await getPublicSettings();

  return (
    <HeaderFrame>
      <a
        href="#main"
        className="sr-only rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <nav aria-label="Main" className="flex h-15 items-center gap-2 pr-2 pl-4 sm:pl-5">
        {/* Logo | links (centred) | actions: the outer two share the spare width. */}
        <div className="flex flex-1">
          <Link
            href="/"
            aria-label={`${settings.business_name} home`}
            className="-m-1.5 rounded-full p-1.5 text-[15px] transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:text-[17px] lg:text-[19px]"
          >
            <BrandLockup name={settings.business_name} priority />
          </Link>
        </div>
        <NavLinks />
        <div className="flex flex-1 items-center justify-end gap-1">
          <ThemeToggle />
          <Button asChild className="hidden gap-1.5 pr-4 sm:inline-flex">
            <Link href={BOOK_HREF}>
              Book now
              <ArrowUpRightIcon
                className="size-4 transition-transform duration-200 group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5"
                aria-hidden
              />
            </Link>
          </Button>
          <MobileNav businessName={settings.business_name} />
        </div>
      </nav>
    </HeaderFrame>
  );
}
