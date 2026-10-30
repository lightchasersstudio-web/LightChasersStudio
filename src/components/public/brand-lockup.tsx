import Image from "next/image";

import { cn } from "@/lib/utils";

// Cut from public/brand/logo.jpg by scripts/brand-assets.mjs (transparent, with
// ivory-ink copies for dark backgrounds). Intrinsic sizes keep next/image happy.
const MARK = { width: 208, height: 192 };
const WORDMARK = { width: 537, height: 160 };

/**
 * The logo laid out side by side: the camera mark, then "Light Chasers / STUDIO".
 * `tone="auto"` follows the theme; `"light"` is for dark panels (ivory ink).
 */
export function BrandLockup({
  name,
  tone = "auto",
  wordmark = true,
  priority,
  className,
}: {
  name: string;
  tone?: "auto" | "light";
  wordmark?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const piece = (src: string, size: typeof MARK, sizeClass: string, show: string) => (
    <Image
      src={src}
      alt=""
      width={size.width}
      height={size.height}
      priority={priority}
      className={cn("w-auto select-none", sizeClass, show)}
      draggable={false}
    />
  );
  const both = (base: string, size: typeof MARK, sizeClass: string) =>
    tone === "light" ? (
      piece(`/brand/${base}-dark.png`, size, sizeClass, "")
    ) : (
      <>
        {piece(`/brand/${base}.png`, size, sizeClass, "dark:hidden")}
        {piece(`/brand/${base}-dark.png`, size, sizeClass, "hidden dark:block")}
      </>
    );

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="sr-only">{name}</span>
      {both("mark", MARK, "h-[2.1em]")}
      {wordmark && both("wordmark", WORDMARK, "h-[1.65em]")}
    </span>
  );
}
