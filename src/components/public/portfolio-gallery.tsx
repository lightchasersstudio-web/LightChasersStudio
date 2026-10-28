"use client";

import { ChevronLeftIcon, ChevronRightIcon, ExpandIcon, ImagesIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import { bookHref } from "@/components/public/site-nav";
import { ShareButton } from "@/components/shared/share-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { categoryLabel, SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/catalog";
import { publicImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { PublicPhoto } from "@/server/queries/public";

/** Taller than wide by a clear margin; these get a two-row cell. Unknown sizes count as wide. */
function isUpright(photo: PublicPhoto) {
  return (photo.height ?? 0) > (photo.width ?? 0) * 1.1;
}

export function PortfolioGallery({ photos }: { photos: PublicPhoto[] }) {
  const [filter, setFilter] = useState<ServiceCategory | "all">("all");
  const [open, setOpen] = useState<number | null>(null);
  const visible = filter === "all" ? photos : photos.filter((p) => p.category === filter);
  const filters = SERVICE_CATEGORIES.filter((c) => photos.some((p) => p.category === c.value));

  if (photos.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed p-12 text-center">
        <ImagesIcon className="mx-auto size-10 text-terracotta" aria-hidden />
        <p className="mt-3 text-lg text-muted-foreground">
          Our gallery is being curated. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <>
      {filters.length > 1 && (
        <div role="group" aria-label="Filter by category" className="mb-8 flex flex-wrap gap-2">
          {[{ value: "all" as const, label: "All" }, ...filters].map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        Showing {visible.length} photo{visible.length === 1 ? "" : "s"}
      </p>

      {/*
        Gallery wall: every row is a landscape (3:2) cell sized from the container width,
        so wide photos fill one cell and upright ones span two rows; `dense` packs the gaps.
        The full photo, uncropped, opens in the viewer.
      */}
      <div className="@container">
        <ul className="grid grid-flow-row-dense auto-rows-[calc((100cqw-var(--gap))/2*2/3)] grid-cols-2 gap-(--gap) [--gap:0.75rem] sm:[--gap:1.25rem] lg:auto-rows-[calc((100cqw-2*var(--gap))/3*2/3)] lg:grid-cols-3">
          {visible.map((photo, i) => (
            <li key={photo.id} className={cn(isUpright(photo) && "row-span-2")}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="group relative block size-full rounded-md bg-white p-1.5 shadow-[0_10px_30px_-14px_rgb(43_58_56/0.45)] ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_-14px_rgb(43_58_56/0.55)] focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-2.5"
                aria-label={`Open photo: ${photo.alt_text}`}
              >
                <span className="relative block size-full overflow-hidden rounded-[3px] bg-muted">
                  <Image
                    src={publicImageUrl("portfolio", photo.storage_path)}
                    alt={photo.alt_text}
                    fill
                    sizes="(min-width: 1024px) 33vw, 50vw"
                    placeholder={photo.blur_data_url ? "blur" : "empty"}
                    blurDataURL={photo.blur_data_url ?? undefined}
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
                  />
                  {/* Label on hover/focus: the package if linked, else the kind of shoot. */}
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-black/65 to-transparent px-3 pt-10 pb-2 text-left text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="truncate font-script text-xl leading-tight">
                      {photo.service?.name ?? categoryLabel(photo.category)}
                    </span>
                    <ExpandIcon className="mb-1 size-4 shrink-0" aria-hidden />
                  </span>
                </span>
                {/* Viewfinder corners, shown on hover. */}
                <span
                  aria-hidden
                  className="viewfinder pointer-events-none absolute inset-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:inset-4"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Lightbox photos={visible} index={open} onIndex={setOpen} />
    </>
  );
}

function Lightbox({
  photos,
  index,
  onIndex,
}: {
  photos: PublicPhoto[];
  index: number | null;
  onIndex: (i: number | null) => void;
}) {
  const touchX = useRef<number | null>(null);
  const photo = index === null ? null : photos[index];
  const go = (delta: number) =>
    index !== null && onIndex((index + delta + photos.length) % photos.length);

  return (
    <Dialog open={photo != null} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogContent
        showCloseButton={false}
        className="h-dvh max-h-dvh w-screen max-w-none rounded-none border-0 bg-black/95 p-0 text-white ring-0 sm:max-w-none"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          if (start != null && end != null && Math.abs(end - start) > 50) go(end < start ? 1 : -1);
          touchX.current = null;
        }}
      >
        {photo && (
          <figure className="flex h-full flex-col">
            <div className="relative flex-1">
              <DialogClose asChild>
                <LightboxButton label="Close" className="absolute top-3 right-3 z-10">
                  <XIcon className="size-6" aria-hidden />
                </LightboxButton>
              </DialogClose>
              <Image
                key={photo.id}
                src={publicImageUrl("portfolio", photo.storage_path)}
                alt={photo.alt_text}
                fill
                sizes="100vw"
                placeholder={photo.blur_data_url ? "blur" : "empty"}
                blurDataURL={photo.blur_data_url ?? undefined}
                className="object-contain"
              />
            </div>
            <figcaption className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-8">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate font-sans text-base font-semibold text-white">
                  {photo.caption ?? photo.alt_text}
                </DialogTitle>
                <DialogDescription className="text-sm text-white/75">
                  {index! + 1} of {photos.length}
                </DialogDescription>
              </div>
              <Button
                asChild
                className="order-last w-full bg-white text-black hover:bg-white/90 sm:order-none sm:w-auto"
              >
                {photo.service ? (
                  <Link href={bookHref(photo.service.slug)}>Book this package</Link>
                ) : (
                  <Link href={`/services#${photo.category}`}>
                    See {categoryLabel(photo.category)} packages
                  </Link>
                )}
              </Button>
              <ShareButton
                path={photo.service ? `/services/${photo.service.slug}` : "/portfolio"}
                title={photo.service ? photo.service.name : "Our portfolio"}
                text={photo.caption ?? photo.alt_text}
                variant="ghost"
                className="h-12 rounded-full bg-white/10 px-4 text-white hover:bg-white/20 hover:text-white"
              />
              {photos.length > 1 && (
                <div className="flex gap-2">
                  <LightboxButton label="Previous photo" onClick={() => go(-1)}>
                    <ChevronLeftIcon className="size-6" aria-hidden />
                  </LightboxButton>
                  <LightboxButton label="Next photo" onClick={() => go(1)}>
                    <ChevronRightIcon className="size-6" aria-hidden />
                  </LightboxButton>
                </div>
              )}
            </figcaption>
          </figure>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LightboxButton({
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
        "grid size-12 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20",
        "focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none",
        className,
      )}
    />
  );
}
