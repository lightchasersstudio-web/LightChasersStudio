"use client";

import { CheckCircle2Icon, IdCardIcon, Loader2Icon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES, prepareImage } from "@/lib/images/prepare-image";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { getStudentIdUploadUrl } from "@/server/actions/student-id";

/**
 * Photo of a student's ID for a workshop sign-up. Resized and re-encoded in the
 * browser (which also strips EXIF/GPS), then uploaded to the private
 * `student-ids` bucket through a one-time link from the server. `value` is the
 * uploaded file's path; the admin reviews the photo on the booking page.
 */
export function StudentIdUpload({
  value,
  onChange,
  invalid,
  label,
}: {
  value: string;
  onChange: (path: string) => void;
  invalid?: boolean;
  label: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const image = await prepareImage(file, 1600);
      const link = await getStudentIdUploadUrl({ ext: image.ext });
      if (!link.ok) throw new Error(link.error);
      const { error: uploadError } = await createClient()
        .storage.from("student-ids")
        .uploadToSignedUrl(link.data.path, link.data.token, image.blob, {
          contentType: image.blob.type,
        });
      if (uploadError) throw new Error("The upload failed. Please try again.");
      setPreview(URL.createObjectURL(image.blob));
      onChange(link.data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-2xl border border-dashed bg-background p-4",
        invalid && !value && "border-destructive",
      )}
    >
      {preview ? (
        // A local preview of the photo just uploaded (a blob URL, so not next/image).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-16 w-24 rounded-lg object-cover" />
      ) : (
        <span className="grid h-16 w-24 place-items-center rounded-lg bg-accent text-accent-foreground">
          <IdCardIcon className="size-7" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1 text-sm">
        {value ? (
          <p className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2Icon className="size-4 text-primary" aria-hidden />
            Student ID uploaded
          </p>
        ) : (
          <p className="font-semibold">Upload a photo of a valid student ID</p>
        )}
        <p className="text-muted-foreground">
          We check it before the workshop. Only the studio sees it.
        </p>
        {error && (
          <p role="alert" className="mt-1 text-destructive">
            {error}
          </p>
        )}
      </div>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy && <Loader2Icon className="animate-spin" aria-hidden />}
        {value ? "Change photo" : "Upload ID"}
      </Button>
    </div>
  );
}
