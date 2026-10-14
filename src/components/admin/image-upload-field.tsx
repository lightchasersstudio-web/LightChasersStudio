"use client";

import { ImagePlusIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { discardUpload, prepareImage, uploadImage } from "@/lib/images/prepare-image";
import { publicImageUrl, type PublicBucket } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * Single-image picker: uploads straight to Storage (admin RLS) and reports the
 * new path; the parent form saves it. Replacing an unsaved upload discards it.
 * shortcut: an upload abandoned by leaving the page stays in the bucket; add a
 * cleanup job if that ever matters.
 */
export function ImageUploadField({
  bucket,
  folder,
  value,
  onChange,
  maxEdge,
  aspect = "aspect-[4/3]",
  label,
  invalid,
}: {
  bucket: PublicBucket;
  folder: string;
  value: string | null;
  onChange: (path: string | null) => void;
  maxEdge: number;
  aspect?: string;
  label: string;
  invalid?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const unsaved = useRef<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadImage(bucket, folder, await prepareImage(file, maxEdge));
      if (unsaved.current) void discardUpload(bucket, [unsaved.current]);
      unsaved.current = path;
      onChange(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative grid w-full max-w-sm place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-muted/50",
          aspect,
          invalid && "border-destructive",
        )}
      >
        {value ? (
          <Image
            src={publicImageUrl(bucket, value)}
            alt={label}
            fill
            sizes="(min-width: 640px) 384px, 100vw"
            className="object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <ImagePlusIcon className="size-8 text-terracotta" aria-hidden />
            No image yet
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-background/70">
            <Loader2Icon className="size-6 animate-spin" aria-hidden />
            <span className="sr-only">Uploading…</span>
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
          disabled={busy}
          aria-label={value ? `Replace ${label}` : `Upload ${label}`}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlusIcon aria-hidden />
          {value ? "Replace" : "Upload"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onChange(null)}>
            <Trash2Icon aria-hidden />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
