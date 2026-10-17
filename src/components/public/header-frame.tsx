"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** The sticky header bar: transparent at the top, a soft frosted card once you scroll. */
export function HeaderFrame({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={cn(
        "sticky top-0 z-30 border-b border-transparent transition-[background-color,border-color,box-shadow] duration-300",
        scrolled
          ? "border-border/70 bg-background/80 shadow-[0_8px_24px_-18px_rgb(43_58_56/0.45)] backdrop-blur-md"
          : "bg-background/40 backdrop-blur-sm",
      )}
    >
      {children}
    </header>
  );
}
