"use client";

import { MotionConfig, motion, type PanInfo } from "motion/react";
import { useRef, useState } from "react";

import { PhotoPolaroid, PlaceholderPolaroid } from "@/components/public/photo-polaroid";
import { Sparkle } from "@/components/shared/sparkle";
import type { PublicPhoto } from "@/server/queries/public";

// Resting pose per depth (0 = top card). Deeper cards sit behind the last one, hidden.
const POSES = [
  { x: 0, y: 0, rotate: 3, scale: 1 },
  { x: -44, y: 24, rotate: -6, scale: 0.95 },
  { x: 44, y: 40, rotate: 8, scale: 0.92 },
];
const SPRING = { type: "spring", stiffness: 260, damping: 24 } as const;
const SWIPE_DISTANCE = 80;
const SWIPE_VELOCITY = 450;

/**
 * Fanned polaroid stack in the hero. Tap the top photo or swipe it away and it
 * flies off, then tucks in at the back. Fills up to 3 cards with placeholders.
 */
export function HeroDeck({ photos }: { photos: PublicPhoto[] }) {
  const count = Math.max(photos.length, 3);
  // One state so a landing flight and a new swipe can't both rotate the stack.
  const [{ order, flying }, setDeck] = useState<{
    order: number[];
    flying: { card: number; dir: 1 | -1 } | null;
  }>(() => ({ order: [...Array(count).keys()], flying: null }));
  const dragged = useRef(false);

  function next(dir: 1 | -1 = 1) {
    // A swipe during a flight lands the flying card and sends the next one.
    setDeck((d) =>
      d.flying
        ? { order: rotate(d.order), flying: { card: d.order[1]!, dir } }
        : { order: d.order, flying: { card: d.order[0]!, dir } },
    );
  }

  function onDragEnd(_: unknown, { offset, velocity }: PanInfo) {
    if (Math.abs(offset.x) > SWIPE_DISTANCE || Math.abs(velocity.x) > SWIPE_VELOCITY) {
      next(offset.x < 0 ? -1 : 1);
    }
  }

  // While the top card is in flight, the others already move up one place.
  const stack = flying ? order.slice(1) : order;

  return (
    <MotionConfig reducedMotion="user">
      {/* `isolate` keeps the cards' z-indexes inside the deck, below the sticky header. */}
      <div className="relative isolate grid w-[min(100%,22rem)] [grid-template-areas:'stack']">
        {order.map((card) => {
          const isFlying = flying?.card === card;
          const depth = isFlying ? -1 : stack.indexOf(card);
          const isTop = depth === 0;
          const pose = POSES[Math.min(depth, POSES.length - 1)]!;
          const photo = photos[card];
          return (
            <motion.div
              key={card}
              data-depth={depth}
              className="w-[62%] cursor-pointer justify-self-center select-none [grid-area:stack] *:animate-in *:duration-700 *:fill-mode-both *:zoom-in-95 *:fade-in [&_img]:pointer-events-none"
              style={{ zIndex: isFlying ? 40 : 30 - depth, touchAction: "pan-y" }}
              initial={false}
              animate={
                isFlying
                  ? { x: flying.dir * 320, y: -30, rotate: flying.dir * 24, scale: 1, opacity: 1 }
                  : { ...pose, opacity: depth < POSES.length ? 1 : 0 }
              }
              transition={isFlying ? { duration: 0.3, ease: "easeIn" } : SPRING}
              onAnimationComplete={() =>
                setDeck((d) =>
                  d.flying?.card === card ? { order: rotate(d.order), flying: null } : d,
                )
              }
              drag={isTop ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.9}
              onDragStart={() => (dragged.current = true)}
              onDragEnd={onDragEnd}
              whileTap={isTop ? { scale: 0.97 } : undefined}
              onClick={() => {
                // A drag ends with a click event too; only a plain tap shuffles.
                if (isTop && !dragged.current) next();
                dragged.current = false;
              }}
            >
              <div style={{ animationDelay: `${150 + card * 150}ms` }}>
                {photo ? (
                  <PhotoPolaroid
                    photo={photo}
                    caption={photo.caption}
                    sizes="(min-width: 768px) 220px, 55vw"
                    priority={card === 0}
                  />
                ) : (
                  <PlaceholderPolaroid index={card} />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => next()}
        className="mt-10 inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 font-script text-xl text-terracotta-ink transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Sparkle className="size-3 text-terracotta" />
        tap or swipe for the next photo
      </button>
    </MotionConfig>
  );
}

/** Moves the top card to the back. */
function rotate(order: number[]) {
  return [...order.slice(1), order[0]!];
}
