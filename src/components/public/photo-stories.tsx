"use client";

import { ArrowRightIcon, PauseIcon, PlayIcon, XIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type StoryPhoto = {
  id: string;
  src: string;
  alt: string;
  caption: string | null;
  blur: string | null;
};
export type Story = { id: string; label: string; href: string; photos: StoryPhoto[] };

const SECONDS_PER_PHOTO = 5;

/**
 * Instagram-style highlight reels: a row of circles, one per kind of shoot.
 * Tapping one plays its photos full screen; tap the sides to skip, hold to pause.
 */
export function PhotoStories({ stories }: { stories: Story[] }) {
  const [open, setOpen] = useState<{ story: number; photo: number } | null>(null);
  if (stories.length === 0) return null;

  return (
    <>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pt-1 pb-3 sm:justify-center sm:gap-6">
        {stories.map((story, i) => (
          <li key={story.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setOpen({ story: i, photo: 0 })}
              className="group flex w-20 flex-col items-center gap-2 rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:w-24"
              aria-label={`Watch ${story.label} highlights (${story.photos.length} photos)`}
            >
              <span className="rounded-full bg-gradient-to-tr from-terracotta via-blush to-sage p-[3px] transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
                <span className="block rounded-full bg-background p-[3px]">
                  <span className="relative block size-16 overflow-hidden rounded-full sm:size-20">
                    <Image
                      src={story.photos[0]!.src}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </span>
                </span>
              </span>
              <span className="line-clamp-2 text-center text-xs leading-tight font-semibold">
                {story.label}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent
          showCloseButton={false}
          className="h-dvh max-h-dvh w-screen max-w-none rounded-none border-0 bg-black p-0 text-white ring-0 sm:h-[min(90dvh,52rem)] sm:w-auto sm:max-w-none sm:rounded-3xl"
        >
          {open && (
            <StoryViewer
              // Remount per photo so its progress bar starts from zero.
              key={`${open.story}-${open.photo}`}
              stories={stories}
              position={open}
              onMove={setOpen}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StoryViewer({
  stories,
  position,
  onMove,
}: {
  stories: Story[];
  position: { story: number; photo: number };
  onMove: (p: { story: number; photo: number } | null) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const story = stories[position.story]!;
  const photo = story.photos[position.photo]!;

  function next() {
    if (position.photo < story.photos.length - 1) {
      onMove({ story: position.story, photo: position.photo + 1 });
    } else if (position.story < stories.length - 1) {
      onMove({ story: position.story + 1, photo: 0 });
    } else {
      onMove(null);
    }
  }
  function prev() {
    if (position.photo > 0) onMove({ story: position.story, photo: position.photo - 1 });
    else if (position.story > 0) {
      const before = stories[position.story - 1]!;
      onMove({ story: position.story - 1, photo: before.photos.length - 1 });
    }
  }
  // With reduced motion, nothing moves on its own: the client taps through.
  const autoplay = !reduceMotion;

  return (
    <div
      className="relative flex h-full flex-col sm:aspect-[9/16]"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev();
        if (e.key === " ") {
          e.preventDefault();
          setPaused((p) => !p);
        }
      }}
    >
      {/* Progress bars */}
      <div className="absolute inset-x-3 top-3 z-20 flex gap-1" aria-hidden>
        {story.photos.map((p, i) => (
          <span key={p.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <span
              className={cn(
                "block h-full rounded-full bg-white",
                i < position.photo && "w-full",
                i > position.photo && "w-0",
                i === position.photo && (autoplay ? "w-full origin-left" : "w-full"),
              )}
              style={
                i === position.photo && autoplay
                  ? {
                      animation: `story-progress ${SECONDS_PER_PHOTO}s linear forwards`,
                      animationPlayState: paused ? "paused" : "running",
                    }
                  : undefined
              }
              onAnimationEnd={i === position.photo && autoplay ? next : undefined}
            />
          </span>
        ))}
      </div>

      <div className="absolute inset-x-3 top-6 z-20 flex items-center justify-between gap-3 pt-2">
        <div className="min-w-0">
          <DialogTitle className="truncate font-sans text-sm font-bold text-white">
            {story.label}
          </DialogTitle>
          <DialogDescription className="text-xs text-white/75">
            {position.photo + 1} of {story.photos.length}
          </DialogDescription>
        </div>
        <div className="flex gap-1">
          {autoplay && (
            <ViewerButton label={paused ? "Play" : "Pause"} onClick={() => setPaused((p) => !p)}>
              {paused ? <PlayIcon className="size-5" /> : <PauseIcon className="size-5" />}
            </ViewerButton>
          )}
          <ViewerButton label="Close" onClick={() => onMove(null)}>
            <XIcon className="size-5" />
          </ViewerButton>
        </div>
      </div>

      <div className="relative flex-1">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(min-width: 640px) 30rem, 100vw"
          placeholder={photo.blur ? "blur" : "empty"}
          blurDataURL={photo.blur ?? undefined}
          className="animate-in object-cover duration-500 fade-in"
          priority
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/75 to-transparent" />

        {/* Tap zones: left goes back, right goes on; holding anywhere pauses. */}
        <button
          type="button"
          aria-label="Previous photo"
          onClick={prev}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          className="absolute inset-y-0 left-0 z-10 w-1/3 focus-visible:outline-none"
        />
        <button
          type="button"
          aria-label="Next photo"
          onClick={next}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
          className="absolute inset-y-0 right-0 z-10 w-2/3 focus-visible:outline-none"
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {photo.caption && <p className="text-sm text-white/90">{photo.caption}</p>}
        <Button asChild className="w-full bg-white text-black hover:bg-white/90">
          <Link href={story.href} onClick={() => onMove(null)}>
            See {story.label} packages
            <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ViewerButton({
  label,
  className,
  ...props
}: { label: string } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className={cn(
        "grid size-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none",
        className,
      )}
    />
  );
}
