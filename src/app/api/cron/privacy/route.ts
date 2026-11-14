import { refuseUnlessCron } from "@/server/cron-auth";
import { purgeExpiredPersonalData } from "@/server/privacy";

/**
 * Daily at 2:00 AM Manila (vercel.json): deletes client details that are past
 * the studio's keeping period (Studio Policy 7.2) and student IDs of finished
 * workshops. See purgeExpiredPersonalData.
 */
export async function GET(req: Request) {
  const refused = refuseUnlessCron(req);
  if (refused) return refused;
  return Response.json(await purgeExpiredPersonalData());
}
