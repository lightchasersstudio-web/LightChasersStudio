"use client";

import { PresentationIcon } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useFloatingState } from "@/components/public/floating-state";

const MotionLink = motion.create(Link);

/**
 * Floating "Workshop" pill on the left of every public page on wider screens
 * (the Messenger bubble sits on the right; phones get it in the "Book now" bar).
 * Hidden on the booking pages and while a workshop banner is on screen.
 */
export function WorkshopButton({ name }: { name: string }) {
  const pathname = usePathname();
  const { promoVisible } = useFloatingState(pathname);
  if (pathname.startsWith("/book") || pathname === "/workshop" || promoVisible) return null;
  return (
    <MotionConfig reducedMotion="user">
      <MotionLink
        href="/workshop"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-6 left-6 z-30 hidden h-14 items-center gap-2 rounded-full bg-terracotta-ink px-5 text-background shadow-[0_12px_28px_-10px_rgb(43_58_56/0.6)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:flex"
      >
        <PresentationIcon className="size-6" aria-hidden />
        <span className="text-sm font-semibold">Workshop</span>
        <span className="sr-only">: sign up for {name}</span>
      </MotionLink>
    </MotionConfig>
  );
}
