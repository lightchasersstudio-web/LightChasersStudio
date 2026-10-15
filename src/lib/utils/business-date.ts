import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const BUSINESS_TZ = "Asia/Manila";

/** Today's date in the studio's timezone, as YYYY-MM-DD. */
export function businessToday(now: Date = new Date()): string {
  return format(new TZDate(now, BUSINESS_TZ), "yyyy-MM-dd");
}

/** Studio-local "YYYY-MM-DD" + "HH:MM" → ISO timestamp (UTC). */
export function businessDateTimeToIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  return new Date(new TZDate(y, m - 1, d, hh, mm, BUSINESS_TZ).getTime()).toISOString();
}

/** "YYYY-MM-DD" → that calendar day at midnight, studio time. */
export function tzDate(date: string): TZDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new TZDate(y, m - 1, d, BUSINESS_TZ);
}

/** "2026-12" + 1 → "2027-01" */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return format(new TZDate(y, m - 1 + delta, 1, BUSINESS_TZ), "yyyy-MM");
}

/** Studio-local "YYYY-MM-DD" of an ISO timestamp. */
export const manilaDate = (iso: string) => format(new TZDate(iso, BUSINESS_TZ), "yyyy-MM-dd");

/** "9:30 AM" studio time for an ISO timestamp. */
export const manilaTime = (iso: string) => format(new TZDate(iso, BUSINESS_TZ), "h:mm a");
