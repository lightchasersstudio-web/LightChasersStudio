"use client";

import { CalendarHeartIcon } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { BOOK_HREF } from "@/components/public/site-nav";
import { Button } from "@/components/ui/button";

/**
 * Phones only: a "Book now" bar that slides up once you scroll past the top,
 * and gets out of the way on the booking pages and over the footer.
 * usePathname() is request data under Cache Components, so it sits behind Suspense.
 */
export function MobileBookBar() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}

function Bar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const footer = document.getElementById("site-footer");
    const observer = new IntersectionObserver(([entry]) =>
      setFooterVisible(entry?.isIntersecting ?? false),
    );
    if (footer) observer.observe(footer);
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [pathname]);

  const onBookingPage = pathname.startsWith("/book");
  const show = scrolled && !footerVisible && !onBookingPage;

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ y: "120%" }}
            animate={{ y: 0 }}
            exit={{ y: "120%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            className="fixed inset-x-3 bottom-3 z-30 md:hidden"
          >
            <div className="flex items-center gap-3 rounded-full border bg-background/90 py-1.5 pr-1.5 pl-5 shadow-[0_12px_30px_-12px_rgb(43_58_56/0.45)] backdrop-blur-md">
              <p className="min-w-0 flex-1 truncate font-script text-xl text-terracotta-ink">
                let&apos;s make memories
              </p>
              <Button asChild size="lg">
                <Link href={BOOK_HREF}>
                  <CalendarHeartIcon aria-hidden />
                  Book now
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
