"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

/** A number that counts up from 0 when it appears. Screen readers get the final value. */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = String(value);
      return;
    }
    const controls = animate(0, value, {
      duration: Math.min(0.4 + value * 0.08, 1.2),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = String(Math.round(v))),
    });
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <>
      <span ref={ref} aria-hidden className="tabular-nums">
        0
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
