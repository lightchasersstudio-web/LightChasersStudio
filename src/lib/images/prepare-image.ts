"use client";

import { createClient } from "@/lib/supabase/browser";
import type { PublicBucket } from "@/lib/storage";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 15 * 1024 * 1024; // matches the bucket limit

export type PreparedImage = {
  blob: Blob;
  ext: "webp" | "jpg";
  width: number;
  height: number;
  blurDataUrl: string;
};

/**
 * Resizes in the browser and re-encodes as WebP (JPEG where WebP encoding isn't
 * supported). Re-encoding also strips EXIF metadata such as GPS location.
 */
export async function prepareImage(file: File, maxEdge: number): Promise<PreparedImage> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`${file.name}: use a JPG, PNG, WebP or AVIF image.`);
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error(`${file.name}: the file is larger than 40 MB.`);

  // createImageBitmap applies the EXIF orientation, so phone photos aren't sideways.
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name}: this image couldn't be read.`);
  });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = drawTo(bitmap, width, height);
  let blob = await toBlob(canvas, "image/webp", 0.86);
  let ext: PreparedImage["ext"] = "webp";
  if (blob.type !== "image/webp") {
    blob = await toBlob(canvas, "image/jpeg", 0.88);
    ext = "jpg";
  }
  if (blob.size > MAX_OUTPUT_BYTES)
    throw new Error(`${file.name}: still too large after resizing.`);

  const tinyWidth = 16;
  const tiny = drawTo(bitmap, tinyWidth, Math.max(1, Math.round((tinyWidth * height) / width)));
  const blurDataUrl = tiny.toDataURL("image/jpeg", 0.6);
  bitmap.close();

  return { blob, ext, width, height, blurDataUrl };
}

/** Uploads to `<folder>/<uuid>.<ext>` and returns the storage path. */
export async function uploadImage(
  bucket: PublicBucket,
  folder: string,
  image: PreparedImage,
): Promise<string> {
  const path = `${folder}/${crypto.randomUUID()}.${image.ext}`;
  const { error } = await createClient().storage.from(bucket).upload(path, image.blob, {
    contentType: image.blob.type,
    cacheControl: "31536000", // paths are unique per upload, so cache forever
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

/** Cleans up an upload whose database row couldn't be saved. */
export async function discardUpload(bucket: PublicBucket, paths: string[]) {
  if (paths.length) await createClient().storage.from(bucket).remove(paths);
}

function drawTo(bitmap: ImageBitmap, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't encode image."))),
      type,
      quality,
    ),
  );
}
