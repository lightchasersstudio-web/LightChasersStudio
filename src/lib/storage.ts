import { getPublicEnv } from "@/lib/env";

export type PublicBucket = "portfolio" | "brand";

/** Public URL for an object in a public bucket (we store paths, never URLs). */
export function publicImageUrl(bucket: PublicBucket, path: string): string {
  const base = getPublicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Object paths the app itself generates: `<folder>/<uuid>.<ext>`. Server actions
 * only accept paths of this shape, so a crafted request can't point a row at
 * an arbitrary object.
 */
export const STORAGE_PATH = {
  portfolio: /^(wedding|portrait|event|commercial)\/[0-9a-f-]{36}\.(webp|jpg)$/,
  serviceCover: /^services\/[0-9a-f-]{36}\.(webp|jpg)$/,
  logo: /^logo\/[0-9a-f-]{36}\.(webp|png|jpg)$/,
} as const;
