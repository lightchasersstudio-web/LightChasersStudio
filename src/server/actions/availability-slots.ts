"use server";

import { z } from "zod";

import { createPublicClient } from "@/lib/supabase/public";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import {
  loadMonthAvailability,
  toPayload,
  type MonthSlotsPayload,
} from "@/server/queries/availability-slots";

const monthSlotsSchema = z.object({
  serviceId: z.uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

/** Public: free start times for a month, for the booking wizard's calendar. */
export async function getMonthSlots(input: unknown): Promise<ActionResult<MonthSlotsPayload>> {
  const parsed = monthSlotsSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid request.");
  try {
    const days = await loadMonthAvailability(
      createPublicClient(),
      parsed.data.serviceId,
      parsed.data.month,
    );
    return days ? ok(toPayload(days)) : fail("This package isn't available to book.");
  } catch (error) {
    console.error("[getMonthSlots]", error);
    return fail("We couldn't load available times. Please try again.");
  }
}
