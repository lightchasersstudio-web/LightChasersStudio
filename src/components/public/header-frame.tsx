"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** The sticky header: a floating frosted bar that firms up (and casts a shadow) once you scroll. */
export function HeaderFrame({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header data-scrolled={scrolled || undefined} className="sticky top-0 z-30 px-3 pt-3 sm:px-5">
      <div
        className={cn(
          "mx-auto max-w-6xl rounded-full border backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300",
          scrolled
            ? "border-border/80 bg-background/85 shadow-[0_12px_32px_-16px_rgb(43_58_56/0.35)]"
            : "border-border/50 bg-background/60",
        )}
      >
        {children}
      </div>
    </header>
  );
}
