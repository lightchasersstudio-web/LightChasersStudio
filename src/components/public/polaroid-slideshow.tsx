"use client";

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type SlideshowPhoto = { src: string; blur: string | null };

/**
 * A polaroid whose photo changes by itself: each one slowly zooms in (Ken
 * Burns) and cross-fades into the next while the handwritten caption stays.
 * Pauses on hover and while the tab is hidden; with reduced motion it stays
 * on the first photo. Decorative (the photos have no alt text).
 */
export function PolaroidSlideshow({
  photos,
  caption,
  intervalMs = 4500,
  sizes,
  className,
}: {
  photos: SlideshowPhoto[];
  caption: string;
  intervalMs?: number;
  sizes: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const many = photos.length > 1;

  useEffect(() => {
    if (!many || reduced || paused) return;
    const timer = setInterval(() => {
      // Don't flip through photos nobody is looking at.
      if (!document.hidden) setIndex((i) => (i + 1) % photos.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [many, reduced, paused, intervalMs, photos.length]);

  const photo = photos[index]!;
  return (
    <MotionConfig reducedMotion="user">
      <figure
        className={cn("polaroid pb-12", className)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2px] bg-muted">
          <AnimatePresence initial={false}>
            <motion.div
              key={photo.src}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
            >
              <motion.div
                className="absolute inset-0"
                initial={{ scale: 1.12, x: index % 2 ? "-2%" : "2%" }}
                animate={{ scale: 1, x: "0%" }}
                transition={{ duration: intervalMs / 1000 + 1.5, ease: "linear" }}
              >
                <Image
                  src={photo.src}
                  alt=""
                  fill
                  sizes={sizes}
                  placeholder={photo.blur ? "blur" : "empty"}
                  blurDataURL={photo.blur ?? undefined}
                  className="object-cover"
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>
          {/* Warm the next photo so the cross-fade never shows a blank frame. */}
          {many && (
            <Image
              src={photos[(index + 1) % photos.length]!.src}
              alt=""
              fill
              sizes={sizes}
              className="pointer-events-none object-cover opacity-0"
            />
          )}
        </div>
        <figcaption className="absolute inset-x-2 bottom-2.5 text-center font-script text-2xl">
          {caption}
        </figcaption>
        {many && (
          <div
            className="absolute top-5 right-5 flex gap-1 rounded-full bg-black/25 px-1.5 py-1 backdrop-blur-sm"
            aria-hidden
          >
            {photos.map((p, i) => (
              <span
                key={p.src}
                className={cn(
                  "size-1.5 rounded-full bg-white/50 transition-all duration-500",
                  i === index && "w-4 bg-white",
                )}
              />
            ))}
          </div>
        )}
      </figure>
    </MotionConfig>
  );
}
