import Link from "next/link";

import { BrandLogo } from "@/components/public/brand-logo";
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
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:px-6"
      >
        <Link
          href="/"
          aria-label={`${settings.business_name} home`}
          className="mr-auto rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <BrandLogo
            logoPath={settings.logo_path}
            name={settings.business_name}
            size={52}
            priority
          />
        </Link>
        <NavLinks />
        <ThemeToggle />
        <Button asChild className="hidden sm:inline-flex">
          <Link href={BOOK_HREF}>Book now</Link>
        </Button>
        <MobileNav businessName={settings.business_name} />
      </nav>
    </HeaderFrame>
  );
}
