import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const BUSINESS_TZ = "Asia/Manila";

/** Today's date in the studio's timezone, as YYYY-MM-DD. */
export function businessToday(now: Date = new Date()): string {
  return format(new TZDate(now, BUSINESS_TZ), "yyyy-MM-dd");
}
