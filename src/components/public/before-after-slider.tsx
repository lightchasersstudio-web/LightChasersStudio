"use client";

import { ChevronsLeftRightIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Drag (or use the arrow keys) to compare the unedited photo with the final
 * edit. A native range input sits on top, so touch, mouse, keyboard and
 * screen readers all work.
 */
export function BeforeAfterSlider({
  before,
  after,
  width,
  height,
  alt,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  beforeClassName,
}: {
  before: string;
  after: string;
  width: number;
  height: number;
  alt: string;
  sizes?: string;
  /** Sample preview only: styles the "before" image. */
  beforeClassName?: string;
}) {
  const [position, setPosition] = useState(50);

  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-muted shadow-lg select-none"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <Image src={after} alt={`${alt} (edited)`} fill sizes={sizes} className="object-cover" />
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        aria-hidden
      >
        <Image
          src={before}
          alt=""
          fill
          sizes={sizes}
          className={cn("object-cover", beforeClassName)}
        />
      </div>

      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">
        Before
      </span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">
        After
      </span>

      {/* Divider and handle */}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgb(0_0_0/0.4)]"
        style={{ left: `${position}%` }}
        aria-hidden
      >
        <span className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-primary shadow-lg">
          <ChevronsLeftRightIcon className="size-5" />
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        aria-label={`Compare before and after editing: ${alt}`}
        aria-valuetext={`${position}% showing the unedited photo`}
        className="peer absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
      {/* Visible focus for keyboard users (the input itself is invisible). */}
      <span
        className="pointer-events-none absolute inset-0 rounded-3xl ring-ring/60 peer-focus-visible:ring-4"
        aria-hidden
      />
    </div>
  );
}
