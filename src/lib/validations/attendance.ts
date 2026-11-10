import { z } from "zod";

import { cutoffDates, hasTimes, parseCutoff, type DayStatus } from "@/lib/payroll/cutoff";
import { parseAmount } from "@/lib/payroll/money";
import { dateString } from "@/lib/validations/shared";

const time = /^([01]\d|2[0-3]):[0-5]\d$/;

/** One row of the time record. Status "" = nothing recorded (the row is removed). */
const daySchema = z
  .object({
    date: dateString,
    status: z.enum([
      "",
      "present",
      "am",
      "pm",
      "am_pm",
      "rest_day",
      "absent",
      "leave",
      "holiday",
    ] satisfies ("" | DayStatus)[]),
    timeIn: z.string(),
    timeOut: z.string(),
    /** Pesos for this day; "" = the employee's current daily rate. */
    rate: z.string(),
    note: z.string().trim().max(200, "Keep the note under 200 characters."),
  })
  .superRefine((d, ctx) => {
    if (d.status === "") return;
    if (d.rate.trim() !== "") {
      const rate = parseAmount(d.rate);
      if (rate === null || rate < 0 || rate > 1_000_000) {
        ctx.addIssue({
          code: "custom",
          path: ["rate"],
          message: "Enter the day's rate, like 650.",
        });
      }
    }
    if (!hasTimes(d.status)) return;
    if (!time.test(d.timeIn)) {
      ctx.addIssue({ code: "custom", path: ["timeIn"], message: "Enter the time in." });
    }
    if (!time.test(d.timeOut)) {
      ctx.addIssue({ code: "custom", path: ["timeOut"], message: "Enter the time out." });
    } else if (d.timeOut === d.timeIn) {
      ctx.addIssue({
        code: "custom",
        path: ["timeOut"],
        message: "Time out must differ from time in.",
      });
    }
  });

export type AttendanceDayInput = z.input<typeof daySchema>;

export const attendanceSheetSchema = z
  .object({
    employeeId: z.uuid(),
    cutoff: z.string(),
    days: z.array(daySchema).max(16),
  })
  .superRefine((v, ctx) => {
    const cutoff = parseCutoff(v.cutoff);
    if (!cutoff) {
      ctx.addIssue({ code: "custom", path: ["cutoff"], message: "Pick a cut-off." });
      return;
    }
    const allowed = new Set(cutoffDates(cutoff));
    const seen = new Set<string>();
    for (const d of v.days) {
      if (!allowed.has(d.date) || seen.has(d.date)) {
        ctx.addIssue({
          code: "custom",
          path: ["days"],
          message: "These days aren't in the cut-off.",
        });
        return;
      }
      seen.add(d.date);
    }
  })
  .transform((v) => {
    const cutoff = parseCutoff(v.cutoff)!;
    return {
      employeeId: v.employeeId,
      cutoff,
      upserts: v.days
        .filter((d) => d.status !== "")
        .map((d) => ({
          employee_id: v.employeeId,
          work_date: d.date,
          status: d.status as DayStatus,
          time_in: hasTimes(d.status) ? d.timeIn : null,
          time_out: hasTimes(d.status) ? d.timeOut : null,
          // null = the employee's current daily rate (filled in by the database).
          daily_rate: d.rate.trim() === "" ? null : parseAmount(d.rate),
          note: d.note || null,
        })),
      cleared: v.days.filter((d) => d.status === "").map((d) => d.date),
    };
  });

export type AttendanceSheetInput = z.input<typeof attendanceSheetSchema>;
