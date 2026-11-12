import { z } from "zod";

import type { Benefit } from "@/lib/payroll/contributions";
import { parseAmount } from "@/lib/payroll/money";

/** "5" or "2.5" (percent) → 0.05 / 0.025 */
const percent = z.string().transform((v, ctx) => {
  const clean = v.trim().replace(/%$/, "");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(clean) || Number(clean) > 100) {
    ctx.addIssue({ code: "custom", message: "Enter a percentage like 5 or 2.5." });
    return z.NEVER;
  }
  return Math.round(Number(clean) * 100) / 10000;
});

const amount = z.string().transform((v, ctx) => {
  const pesos = parseAmount(v);
  if (pesos === null || pesos > 10_000_000) {
    ctx.addIssue({ code: "custom", message: "Enter an amount like 10000." });
    return z.NEVER;
  }
  return pesos;
});

export const contributionSettingsSchema = z
  .object({
    sssRate: percent,
    sssMscMin: amount,
    sssMscMax: amount,
    sssMscStep: amount.refine((v) => v > 0, "The step must be more than ₱0."),
    philhealthRate: percent,
    philhealthFloor: amount,
    philhealthCeiling: amount,
    pagibigRate: percent,
    pagibigCap: amount,
    workDays: z.string().transform((v, ctx) => {
      const clean = v.trim();
      const n = Number(clean);
      if (!/^\d{1,2}(\.\d{1,2})?$/.test(clean) || n < 1 || n > 31) {
        ctx.addIssue({ code: "custom", message: "Enter the number of days, 1 to 31." });
        return z.NEVER;
      }
      return n;
    }),
    hoursPerDay: z.string().transform((v, ctx) => {
      const clean = v.trim();
      const n = Number(clean);
      if (!/^\d{1,2}(\.\d{1,2})?$/.test(clean) || n < 1 || n > 24) {
        ctx.addIssue({ code: "custom", message: "Enter the hours in a shift, 1 to 24." });
        return z.NEVER;
      }
      return n;
    }),
    amPmRate: amount.refine((v) => v <= 1_000_000, "Enter an amount like 650."),
  })
  .superRefine((v, ctx) => {
    if (v.sssMscMax < v.sssMscMin) {
      ctx.addIssue({
        code: "custom",
        path: ["sssMscMax"],
        message: "The highest MSC can't be lower than the lowest.",
      });
    }
    if (v.philhealthCeiling < v.philhealthFloor) {
      ctx.addIssue({
        code: "custom",
        path: ["philhealthCeiling"],
        message: "The ceiling can't be lower than the floor.",
      });
    }
  })
  .transform((v) => ({
    sss_employee_rate: v.sssRate,
    sss_msc_min: v.sssMscMin,
    sss_msc_max: v.sssMscMax,
    sss_msc_step: v.sssMscStep,
    philhealth_employee_rate: v.philhealthRate,
    philhealth_floor: v.philhealthFloor,
    philhealth_ceiling: v.philhealthCeiling,
    pagibig_employee_rate: v.pagibigRate,
    pagibig_salary_cap: v.pagibigCap,
    work_days_per_month: v.workDays,
    hours_per_day: v.hoursPerDay,
    am_pm_rate: v.amPmRate,
  }));

export type ContributionSettingsFormInput = z.input<typeof contributionSettingsSchema>;

export const setBenefitSchema = z.object({
  employeeId: z.uuid(),
  benefit: z.enum(["sss", "philhealth", "pagibig"] satisfies Benefit[]),
  enabled: z.boolean(),
});
