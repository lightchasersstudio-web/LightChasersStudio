"use client";

import { ImagePlusIcon, Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/catalog";
import {
  ACCEPTED_IMAGE_TYPES,
  discardUpload,
  prepareImage,
  uploadImage,
} from "@/lib/images/prepare-image";
import { cn } from "@/lib/utils";
import { addPortfolioImages } from "@/server/actions/portfolio";

type Staged = { key: string; file: File; preview: string; alt: string };

const MAX_BATCH = 20;

export function PortfolioUploader() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [category, setCategory] = useState<ServiceCategory>("wedding");
  const [progress, setProgress] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const busy = progress !== null;

  // Free preview object URLs when the staged list changes or on unmount.
  const stagedRef = useRef(staged);
  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);
  useEffect(() => () => stagedRef.current.forEach((s) => URL.revokeObjectURL(s.preview)), []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const files = [...list].filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
    if (files.length < list.length)
      toast.error("Some files were skipped: use JPG, PNG, WebP or AVIF.");
    const room = MAX_BATCH - staged.length;
    if (files.length > room) toast.error(`Up to ${MAX_BATCH} photos per upload.`);
    setStaged((s) => [
      ...s,
      ...files.slice(0, room).map((file) => ({
        key: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        alt: "",
      })),
    ]);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Files picked before hydration (slow phones) sit in the input with no onChange
  // fired; pick them up once React is attached.
  useEffect(() => {
    const files = inputRef.current?.files;
    if (files?.length) addFiles(files);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  function unstage(key: string) {
    setStaged((s) => {
      const gone = s.find((x) => x.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return s.filter((x) => x.key !== key);
    });
  }

  async function upload() {
    const missing = staged.find((s) => s.alt.trim().length < 3);
    if (missing) {
      toast.error("Add a short description to every photo (at least 3 characters).");
      document.getElementById(`alt-${missing.key}`)?.focus();
      return;
    }

    const uploaded: string[] = [];
    try {
      const images = [];
      for (const [i, s] of staged.entries()) {
        setProgress(`Uploading ${i + 1} of ${staged.length}…`);
        const prepared = await prepareImage(s.file, 2400);
        const path = await uploadImage("portfolio", category, prepared);
        uploaded.push(path);
        images.push({
          storagePath: path,
          category,
          altText: s.alt.trim(),
          width: prepared.width,
          height: prepared.height,
          blurDataUrl: prepared.blurDataUrl,
        });
      }
      setProgress("Saving…");
      const result = await addPortfolioImages({ images });
      if (!result.ok) throw new Error(result.error);
      toast.success(`Added ${result.data.added} photo${result.data.added === 1 ? "" : "s"}.`);
      staged.forEach((s) => URL.revokeObjectURL(s.preview));
      setStaged([]);
    } catch (error) {
      await discardUpload("portfolio", uploaded);
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border bg-card p-4 sm:p-6">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors hover:border-terracotta hover:bg-blush/40 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
          dragging && "border-terracotta bg-blush/40",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <UploadCloudIcon className="size-10 text-terracotta" aria-hidden />
        <span className="font-heading text-lg font-semibold">Add photos</span>
        <span className="text-sm text-muted-foreground">
          Tap to choose, or drop files here. Up to {MAX_BATCH} at a time; large photos are resized
          automatically and location data is removed.
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          disabled={busy}
          onChange={(e) => addFiles(e.target.files)}
        />
      </label>

      {staged.length > 0 && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="space-y-2 sm:w-64">
              <Label htmlFor={`${inputId}-category`}>Category for these photos</Label>
              <NativeSelect
                id={`${inputId}-category`}
                value={category}
                onChange={(e) => setCategory(e.target.value as ServiceCategory)}
                className="w-full"
                disabled={busy}
              >
                {SERVICE_CATEGORIES.map((c) => (
                  <NativeSelectOption key={c.value} value={c.value}>
                    {c.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <Button size="lg" onClick={upload} disabled={busy} className="sm:ml-auto">
              {busy ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : (
                <ImagePlusIcon aria-hidden />
              )}
              {progress ?? `Upload ${staged.length} photo${staged.length === 1 ? "" : "s"}`}
            </Button>
          </div>
          <p aria-live="polite" className="sr-only">
            {progress}
          </p>

          <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {staged.map((s) => (
              <li key={s.key} className="overflow-hidden rounded-2xl border bg-background">
                <div className="relative aspect-[4/3] bg-muted">
                  {/* Local blob preview; next/image can't optimise object URLs. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.preview} alt="" className="size-full object-cover" />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    aria-label={`Remove ${s.file.name}`}
                    className="absolute top-2 right-2"
                    onClick={() => unstage(s.key)}
                    disabled={busy}
                  >
                    <XIcon aria-hidden />
                  </Button>
                </div>
                <div className="space-y-1.5 p-3">
                  <Label htmlFor={`alt-${s.key}`}>Describe this photo</Label>
                  <Input
                    id={`alt-${s.key}`}
                    value={s.alt}
                    maxLength={300}
                    placeholder="e.g. Couple laughing at Pasonanca Park"
                    disabled={busy}
                    onChange={(e) =>
                      setStaged((list) =>
                        list.map((x) => (x.key === s.key ? { ...x, alt: e.target.value } : x)),
                      )
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
