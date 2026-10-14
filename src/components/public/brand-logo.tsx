import Image from "next/image";

import { publicImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * The admin-uploaded logo, or the bundled one. Logos are on white, so they sit
 * on a white tile that reads in both light and dark mode.
 */
export function BrandLogo({
  logoPath,
  name,
  size,
  priority,
  className,
}: {
  logoPath: string | null;
  name: string;
  size: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block overflow-hidden rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/5",
        className,
      )}
    >
      <Image
        src={logoPath ? publicImageUrl("brand", logoPath) : "/brand/logo.jpg"}
        alt={name}
        width={size}
        height={size}
        sizes={`${size}px`}
        priority={priority}
        className="rounded-xl"
      />
    </span>
  );
}
