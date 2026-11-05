"use client";

import { XIcon } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useState } from "react";

import { MessengerIcon } from "@/components/shared/messenger-icon";

const GREETED_KEY = "lcs:messenger-greeted";

/**
 * Floating "chat on Messenger" bubble on every public page. A small greeting
 * pops up once per visit after a few seconds. On phones it sits above the
 * "Book now" bar so the two never overlap.
 */
export function MessengerButton({ href, businessName }: { href: string; businessName: string }) {
  const [greeting, setGreeting] = useState(false);

  useEffect(() => {
    let greeted = false;
    try {
      greeted = sessionStorage.getItem(GREETED_KEY) === "1";
    } catch {
      // Storage blocked (private mode): just greet.
    }
    if (greeted) return;
    const id = window.setTimeout(() => setGreeting(true), 6000);
    return () => window.clearTimeout(id);
  }, []);

  function dismiss() {
    setGreeting(false);
    try {
      sessionStorage.setItem(GREETED_KEY, "1");
    } catch {
      // Ignore: the greeting may show again on the next page, which is fine.
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="fixed right-4 bottom-[5.25rem] z-30 flex flex-col items-end gap-3 md:right-6 md:bottom-6">
        <AnimatePresence>
          {greeting && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="relative w-60 origin-bottom-right rounded-2xl rounded-br-sm border bg-card p-4 pr-9 text-sm shadow-xl"
              role="status"
            >
              <button
                type="button"
                onClick={dismiss}
                aria-label="Close message"
                className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <XIcon className="size-4" aria-hidden />
              </button>
              <p className="font-script text-xl leading-none text-terracotta-ink">hi there!</p>
              <p className="mt-1.5">
                Questions about a shoot? Message {businessName} on Messenger.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={dismiss}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.8 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          className="group relative flex h-14 items-center gap-2 rounded-full bg-primary pr-4 pl-4 text-primary-foreground shadow-[0_12px_28px_-10px_rgb(43_58_56/0.6)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:pr-5"
        >
          {/* Gentle ping so the bubble gets noticed, without being loud. */}
          <span
            className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/30 [animation-duration:2.6s] [animation-iteration-count:3]"
            aria-hidden
          />
          <MessengerIcon className="size-6" />
          <span className="text-sm font-semibold max-md:sr-only">Chat with us</span>
          <span className="sr-only"> on Messenger (opens in a new tab)</span>
        </motion.a>
      </div>
    </MotionConfig>
  );
}
