import { HeartIcon, PackageIcon, PartyPopperIcon, UsersIcon, type LucideIcon } from "lucide-react";
import Image from "next/image";

import { publicImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { PublicPhoto } from "@/server/queries/public";

/** A portfolio photo in a polaroid frame, with an optional handwritten caption. */
export function PhotoPolaroid({
  photo,
  caption,
  sizes,
  priority,
  className,
}: {
  photo: PublicPhoto;
  caption?: string | null;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={cn("polaroid pb-10", className)}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2px] bg-muted">
        <Image
          src={publicImageUrl("portfolio", photo.storage_path)}
          alt={photo.alt_text}
          fill
          sizes={sizes}
          priority={priority}
          placeholder={photo.blur_data_url ? "blur" : "empty"}
          blurDataURL={photo.blur_data_url ?? undefined}
          className="object-cover"
        />
      </div>
      {caption && (
        <figcaption className="absolute inset-x-2 bottom-2 truncate text-center font-script text-xl">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

const PLACEHOLDERS: { caption: string; icon: LucideIcon; photo: string }[] = [
  { caption: "weddings", icon: HeartIcon, photo: "from-terracotta/25 to-terracotta/75" },
  { caption: "portraits", icon: UsersIcon, photo: "from-sage/40 to-sage" },
  { caption: "events", icon: PartyPopperIcon, photo: "from-terracotta/30 to-sage/70" },
  { caption: "products", icon: PackageIcon, photo: "from-sage/25 to-terracotta/45" },
];

/** Illustrated stand-in until real photos are featured in the admin. */
export function PlaceholderPolaroid({ index, className }: { index: number; className?: string }) {
  const p = PLACEHOLDERS[index % PLACEHOLDERS.length]!;
  return (
    <figure aria-hidden className={cn("polaroid pb-10", className)}>
      <div
        className={cn(
          "grid aspect-[4/5] place-items-center rounded-[2px] bg-linear-to-br",
          p.photo,
        )}
      >
        <p.icon className="size-10 text-white drop-shadow" strokeWidth={1.5} />
      </div>
      <figcaption className="absolute inset-x-2 bottom-2 text-center font-script text-xl">
        {p.caption}
      </figcaption>
    </figure>
  );
}
