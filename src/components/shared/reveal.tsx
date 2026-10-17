"use client";

import { MotionConfig, motion, type Variants } from "motion/react";

// Scroll-in animations for below-the-fold content. Each plays once, when the
// element first comes into view. Reduced motion: shown at once, no movement.
// Above-the-fold content uses CSS `animate-in` instead, so it never waits on JS.

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEWPORT = { once: true, margin: "0px 0px -12% 0px" } as const;

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

/** Fades and rises its children into view. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        variants={rise}
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        transition={{ delay }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}

/** A list whose `<RevealItem>`s come in one after another. */
export function RevealList({
  children,
  className,
  stagger = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.ul
        className={className}
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      >
        {children}
      </motion.ul>
    </MotionConfig>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.li className={className} variants={rise}>
      {children}
    </motion.li>
  );
}
