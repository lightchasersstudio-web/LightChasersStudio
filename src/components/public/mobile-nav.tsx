"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

import { BrandLockup } from "@/components/public/brand-lockup";
import { isActive } from "@/components/public/nav-links";
import { BOOK_HREF, SITE_NAV } from "@/components/public/site-nav";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function MobileNav({ businessName }: { businessName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 lg:hidden" aria-label="Open menu">
          <MenuIcon className="size-6" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,85vw)] bg-background">
        <SheetHeader>
          <SheetTitle className="text-[17px]">
            <BrandLockup name={businessName} />
          </SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 font-script text-lg text-terracotta-ink">
            <Sparkle className="size-3 text-terracotta" />
            let&apos;s make memories
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Main" className="flex flex-col gap-1 px-4">
          {/* usePathname() must sit behind Suspense under Cache Components. */}
          <Suspense fallback={<MenuLinks pathname={null} onNavigate={() => setOpen(false)} />}>
            <ActiveMenuLinks onNavigate={() => setOpen(false)} />
          </Suspense>
          <Button asChild size="lg" className="mt-4">
            <Link href={BOOK_HREF} onClick={() => setOpen(false)}>
              Book now
            </Link>
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function ActiveMenuLinks({ onNavigate }: { onNavigate: () => void }) {
  return <MenuLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

function MenuLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate: () => void }) {
  return (
    <>
      {SITE_NAV.map(({ href, label }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 items-center rounded-2xl px-4 font-heading text-xl font-semibold transition-colors hover:bg-accent",
              active && "bg-accent text-accent-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
