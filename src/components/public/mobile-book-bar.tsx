"use client";

import { CalendarHeartIcon, PresentationIcon } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useSyncExternalStore } from "react";

import { useFloatingState } from "@/components/public/floating-state";
import { BOOK_HREF } from "@/components/public/site-nav";
import { Button } from "@/components/ui/button";

export type BarWorkshop = { name: string; endsAt: string | null };

/**
 * Phones only: a "Book now" bar that slides up once you scroll past the top,
 * and gets out of the way on the booking pages and over the footer. While a
 * workshop is open it also carries the "Workshop" link (the floating pill is
 * desktop-only, so phones don't get a stack of buttons over the content).
 * usePathname() is request data under Cache Components, so it sits behind Suspense.
 */
export function MobileBookBar({ workshop }: { workshop?: BarWorkshop | null }) {
  return (
    <Suspense fallback={null}>
      <Bar workshop={workshop ?? null} />
    </Suspense>
  );
}

const noop = () => () => {};

function Bar({ workshop }: { workshop: BarWorkshop | null }) {
  const pathname = usePathname();
  const { scrolled, footerVisible, promoVisible } = useFloatingState(pathname);
  // The layout is static: check the end time in the browser (like <HideAfter>).
  const workshopOpen = useSyncExternalStore(
    noop,
    () => !!workshop && (!workshop.endsAt || Date.now() < Date.parse(workshop.endsAt)),
    () => false,
  );

  const onBookingPage = pathname.startsWith("/book") || pathname === "/workshop";
  const show = scrolled && !footerVisible && !onBookingPage;
  // The workshop banner has its own sign-up button; don't repeat it right below.
  const showWorkshop = workshopOpen && !promoVisible;

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
            <div className="flex items-center gap-2 rounded-full border bg-background/90 py-1.5 pr-1.5 pl-1.5 shadow-[0_12px_30px_-12px_rgb(43_58_56/0.45)] backdrop-blur-md">
              {showWorkshop ? (
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="min-w-0 flex-1 justify-start bg-blush text-terracotta-ink hover:bg-blush/80 hover:text-terracotta-ink"
                >
                  <Link href="/workshop">
                    <PresentationIcon aria-hidden />
                    <span className="truncate">Workshop</span>
                    <span className="sr-only">: sign up for {workshop?.name}</span>
                  </Link>
                </Button>
              ) : (
                <p className="min-w-0 flex-1 truncate pl-3.5 font-script text-xl text-terracotta-ink">
                  let&apos;s make memories
                </p>
              )}
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
