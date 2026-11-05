"use client";

import { ImagePlusIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { moveItem, ReorderButtons } from "@/components/admin/reorder-buttons";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_IMAGE_TYPES,
  discardUpload,
  prepareImage,
  uploadImage,
} from "@/lib/images/prepare-image";
import { publicImageUrl } from "@/lib/storage";
import { MAX_WORKSHOP_SLIDES, type WorkshopSlide } from "@/lib/validations/workshop-slides";
import { saveWorkshopSlides } from "@/server/actions/services";

/**
 * Workshop admin: the photos that play in the home-page workshop banner.
 * Every change (add, move, remove) saves straight away; with none, the banner
 * picks photos by itself.
 */
export function WorkshopSlidesManager({
  serviceId,
  slides: initial,
}: {
  serviceId: string;
  slides: WorkshopSlide[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [slides, setSlides] = useState(initial);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const busy = uploading !== null || saving;
  const room = MAX_WORKSHOP_SLIDES - slides.length;

  /** Saves the new list; on failure the list goes back and new uploads are discarded. */
  function save(next: WorkshopSlide[], newPaths: string[] = []) {
    const previous = slides;
    setSlides(next);
    startSave(async () => {
      const result = await saveWorkshopSlides({ serviceId, slides: next });
      if (!result.ok) {
        setSlides(previous);
        await discardUpload("portfolio", newPaths);
        toast.error(result.error);
      }
    });
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = [...list].filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
    if (files.length < list.length)
      toast.error("Some files were skipped: use JPG, PNG, WebP or AVIF.");
    if (files.length > room)
      toast.error(`The slideshow holds up to ${MAX_WORKSHOP_SLIDES} photos.`);
    const picked = files.slice(0, room);
    if (inputRef.current) inputRef.current.value = "";
    if (!picked.length) return;

    const added: WorkshopSlide[] = [];
    try {
      for (const [i, file] of picked.entries()) {
        setUploading(`Uploading ${i + 1} of ${picked.length}…`);
        const prepared = await prepareImage(file, 1600);
        const path = await uploadImage("portfolio", "workshop", prepared);
        added.push({
          path,
          width: prepared.width,
          height: prepared.height,
          blur: prepared.blurDataUrl,
        });
      }
    } catch (error) {
      await discardUpload(
        "portfolio",
        added.map((s) => s.path),
      );
      toast.error(error instanceof Error ? error.message : "Upload failed.");
      return;
    } finally {
      setUploading(null);
    }
    save(
      [...slides, ...added],
      added.map((s) => s.path),
    );
  }

  return (
    <section
      aria-labelledby="workshop-slides"
      className="mt-8 space-y-4 rounded-3xl border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="workshop-slides" className="text-xl font-semibold">
            Home page slideshow
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            The photos that play one after another in the workshop banner on the home page, in this
            order. Upright photos fit the frame best. With no photos here, the banner uses the
            workshop&apos;s cover photo and a few from the portfolio.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          disabled={busy || room <= 0}
          onChange={(e) => addFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || room <= 0}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2Icon className="animate-spin" aria-hidden />
          ) : (
            <ImagePlusIcon aria-hidden />
          )}
          {uploading ?? (saving ? "Saving…" : "Add photos")}
        </Button>
      </div>
      <p aria-live="polite" className="sr-only">
        {uploading ?? (saving ? "Saving…" : "")}
      </p>

      {slides.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
          No slideshow photos yet: the banner picks them automatically.
        </p>
      ) : (
        <>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {slides.map((slide, i) => (
              <li key={slide.path} className="overflow-hidden rounded-2xl border bg-background">
                <div className="relative aspect-[4/5] bg-muted">
                  <Image
                    src={publicImageUrl("portfolio", slide.path)}
                    alt={`Slideshow photo ${i + 1}`}
                    fill
                    sizes="(min-width: 1024px) 14rem, (min-width: 640px) 30vw, 45vw"
                    placeholder={slide.blur ? "blur" : "empty"}
                    blurDataURL={slide.blur ?? undefined}
                    className="object-cover"
                  />
                  <span className="absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-background/90 text-xs font-bold">
                    {i + 1}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 p-1.5">
                  <ReorderButtons
                    index={i}
                    count={slides.length}
                    name={`photo ${i + 1}`}
                    disabled={busy}
                    onMove={(from, to) => save(moveItem(slides, from, to))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove photo ${i + 1}`}
                    disabled={busy}
                    onClick={() => save(slides.filter((s) => s.path !== slide.path))}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            {slides.length} of {MAX_WORKSHOP_SLIDES} photos. Removing a photo deletes it for good.
          </p>
        </>
      )}
    </section>
  );
}
