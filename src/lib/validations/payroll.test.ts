import { describe, expect, it } from "vitest";

import {
  contributionSettingsSchema,
  type ContributionSettingsFormInput,
} from "@/lib/validations/payroll";

const form: ContributionSettingsFormInput = {
  sssRate: "5",
  sssMscMin: "5,000",
  sssMscMax: "35000",
  sssMscStep: "500",
  philhealthRate: "2.5%",
  philhealthFloor: "10000",
  philhealthCeiling: "100000",
  pagibigRate: "2",
  pagibigCap: "10000",
  workDays: "30",
  hoursPerDay: "8",
  amPmRate: "650",
};

describe("contributionSettingsSchema", () => {
  it("turns percentages into fractions", () => {
    expect(contributionSettingsSchema.parse(form)).toEqual({
      sss_employee_rate: 0.05,
      sss_msc_min: 5000,
      sss_msc_max: 35000,
      sss_msc_step: 500,
      philhealth_employee_rate: 0.025,
      philhealth_floor: 10000,
      philhealth_ceiling: 100000,
      pagibig_employee_rate: 0.02,
      pagibig_salary_cap: 10000,
      work_days_per_month: 30,
      hours_per_day: 8,
      am_pm_rate: 650,
    });
    expect(
      contributionSettingsSchema.parse({ ...form, sssRate: "4.75", workDays: "21.75" }),
    ).toMatchObject({ sss_employee_rate: 0.0475, work_days_per_month: 21.75 });
  });

  it("refuses ranges that don't make sense", () => {
    const result = contributionSettingsSchema.safeParse({
      ...form,
      sssMscMax: "4000",
      philhealthCeiling: "5000",
      pagibigRate: "120",
      sssMscStep: "0",
      workDays: "40",
      hoursPerDay: "25",
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.path[0]).sort()).toEqual(
      ["hoursPerDay", "pagibigRate", "sssMscStep", "workDays"].sort(),
    );
    // Range checks run once every field is valid.
    const ranges = contributionSettingsSchema.safeParse({
      ...form,
      sssMscMax: "4000",
      philhealthCeiling: "5000",
    });
    expect(ranges.error!.issues.map((i) => i.path[0]).sort()).toEqual([
      "philhealthCeiling",
      "sssMscMax",
    ]);
  });
});
