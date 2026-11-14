import { businessTomorrowRange } from "@/lib/utils/business-date";
import { sendShootReminder } from "@/server/booking-notifications";
import { refuseUnlessCron } from "@/server/cron-auth";
import {
  claimReminder,
  listRemindersDue,
  loadBookingRecord,
} from "@/server/queries/booking-record";

/**
 * Daily at 9:00 AM Manila (vercel.json): "See you tomorrow!" to every confirmed
 * booking that starts tomorrow (studio time). Each booking is emailed once
 * (bookings.reminder_sent_at, cleared if its time moves).
 */
export async function GET(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;

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
