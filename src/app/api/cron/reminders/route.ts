import { timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env.server";
import { businessTomorrowRange } from "@/lib/utils/business-date";
import { sendShootReminder } from "@/server/booking-notifications";
import {
  claimReminder,
  listRemindersDue,
  loadBookingRecord,
} from "@/server/queries/booking-record";

/** Constant-time "Bearer <CRON_SECRET>" check. */
function authorised(header: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily at 9:00 AM Manila (vercel.json): "See you tomorrow!" to every confirmed
 * booking that starts tomorrow (studio time). Each booking is emailed once
 * (bookings.reminder_sent_at, cleared if its time moves).
 */
export async function GET(req: Request) {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) return new Response("Reminders not configured", { status: 503 });
  if (!authorised(req.headers.get("authorization"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ids = await listRemindersDue(businessTomorrowRange());
  let sent = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      if (!(await claimReminder(id))) continue;
      const record = await loadBookingRecord({ id });
      if (!record) continue;
      await sendShootReminder(record);
      sent++;
    } catch (error) {
      failed++;
      console.error("[cron reminders]", id, error);
    }
  }
  return Response.json({ due: ids.length, sent, failed });
}
