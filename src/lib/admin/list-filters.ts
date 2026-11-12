import { z } from "zod";

/** Rows per page on the admin list pages (bookings, clients, activity). */
export const PAGE_SIZE = 25;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = [
  "pending_payment",
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "declined",
  "expired",
] as const;

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Anything malformed is simply ignored, so a hand-edited URL never errors.
const text = z.string().trim().max(100).catch("");
const page = z.coerce.number().int().min(1).max(10_000).catch(1);

export const bookingFiltersSchema = z.object({
  q: text,
  status: z.enum(STATUSES).or(z.literal("")).catch(""),
  service: z.uuid().or(z.literal("")).catch(""),
  from: z.string().regex(DAY).or(z.literal("")).catch(""),
  to: z.string().regex(DAY).or(z.literal("")).catch(""),
  page,
});
export type BookingFilters = z.infer<typeof bookingFiltersSchema>;

export const listFiltersSchema = z.object({ q: text, kind: text, page });
export type ListFilters = z.infer<typeof listFiltersSchema>;

export function parseFilters<S extends z.ZodType>(schema: S, params: Params): z.infer<S> {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, one(v) ?? ""]));
  return schema.parse(flat);
}

/** `path?…` keeping only the filters that are set (page 1 is left out). */
export function filtersHref(path: string, filters: Record<string, string | number>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === "" || (k === "page" && v === 1)) continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * A search term safe inside a PostgREST `or=(…ilike…)` filter: characters with
 * meaning there (commas, brackets, quotes, wildcards, backslashes) become spaces.
 */
export function searchTerm(q: string): string {
  return q
    .replace(/[,()"'\\%*:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
