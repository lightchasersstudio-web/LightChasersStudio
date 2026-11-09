"use client";

import { ImagePlusIcon, Loader2Icon, Trash2Icon, UserRoundIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { discardUpload, prepareImage, uploadImage } from "@/lib/images/prepare-image";

/**
 * Staff photo: uploads to the private employee-photos bucket (admin RLS) and
 * reports the new path; the form saves it. The preview of a new upload comes
 * from the file itself, an existing photo from a signed link.
 */
export function EmployeePhotoField({
  value,
  initialUrl,
  onChange,
}: {
  value: string | null;
  initialUrl: string | null;
  onChange: (path: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const unsaved = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(initialUrl);

  useEffect(
    () => () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const image = await prepareImage(file, 800);
      const path = await uploadImage("employee-photos", "", image);
      if (unsaved.current) void discardUpload("employee-photos", [unsaved.current]);
      unsaved.current = path;
      setPreview(URL.createObjectURL(image.blob));
      onChange(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const shown = value ? preview : null;

  return (
    <div className="flex items-center gap-4">
      <div className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-dashed bg-muted/50">
        {shown ? (
          // Signed or blob URL of a private photo: not something next/image can optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Employee photo" className="size-full object-cover" />
        ) : (
          <UserRoundIcon className="size-9 text-muted-foreground" aria-hidden />
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
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
          disabled={busy}
          aria-label={value ? "Replace photo" : "Upload photo"}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlusIcon aria-hidden />
          {value ? "Replace photo" : "Add photo"}
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
