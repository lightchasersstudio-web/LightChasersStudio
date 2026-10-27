"use client";

import { PresentationIcon } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MotionLink = motion.create(Link);

/**
 * Floating "Workshop" pill on the left of every public page (the Messenger
 * bubble sits on the right). Hidden on the booking pages themselves.
 */
export function WorkshopButton({ name }: { name: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/book") || pathname === "/workshop") return null;
  return (
    <MotionConfig reducedMotion="user">
      <MotionLink
        href="/workshop"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-[5.25rem] left-4 z-30 flex h-14 items-center gap-2 rounded-full bg-terracotta-ink px-4 text-background shadow-[0_12px_28px_-10px_rgb(43_58_56/0.6)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:bottom-6 md:left-6 md:px-5"
      >
        <PresentationIcon className="size-6" aria-hidden />
        <span className="text-sm font-semibold">Workshop</span>
        <span className="sr-only">: sign up for {name}</span>
      </MotionLink>
    </MotionConfig>
  );
}
