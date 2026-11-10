import { describe, expect, it } from "vitest";

import {
  computeDailyPay,
  isTimeOutEdited,
  SHIFT_START,
  shiftTimeOut,
} from "@/lib/payroll/daily-pay";

const base = { minutes: 480, dailyRate: 650, shiftMinutes: 480, overtimeRate: null };

describe("SHIFT_START", () => {
  it("suggests AM 9:30 AM–5:30 PM and PM 2:00 PM–10:00 PM", () => {
    expect([SHIFT_START.am, shiftTimeOut(SHIFT_START.am)]).toEqual(["09:30", "17:30"]);
    expect([SHIFT_START.pm, shiftTimeOut(SHIFT_START.pm)]).toEqual(["14:00", "22:00"]);
  });
});

describe("shiftTimeOut", () => {
  it("adds 8 hours", () => {
    expect(shiftTimeOut("08:00")).toBe("16:00");
    expect(shiftTimeOut("14:00")).toBe("22:00");
  });

  it("wraps past midnight onto the next day", () => {
    expect(shiftTimeOut("18:30")).toBe("02:30");
    expect(shiftTimeOut("16:00")).toBe("00:00");
  });

  it("is null for a bad time", () => {
    expect(shiftTimeOut("")).toBeNull();
    expect(shiftTimeOut("25:00")).toBeNull();
  });
});

describe("isTimeOutEdited", () => {
  it("flags an AM/PM time out that isn't time in + 8 hours", () => {
    expect(isTimeOutEdited("am", "08:00", "16:00")).toBe(false);
    expect(isTimeOutEdited("am", "08:00", "15:00")).toBe(true);
    expect(isTimeOutEdited("pm", "18:00", "02:00")).toBe(false);
    expect(isTimeOutEdited("present", "08:00", "12:00")).toBe(false);
  });
});

describe("computeDailyPay", () => {
  it("AM and PM pay the full daily rate, however long the day ran", () => {
    expect(computeDailyPay({ ...base, status: "am" }).payCents).toBe(65000);
    expect(computeDailyPay({ ...base, status: "pm", minutes: 300 }).payCents).toBe(65000);
    expect(
      computeDailyPay({ ...base, status: "pm", minutes: 600, overtimeRate: 100 }),
    ).toMatchObject({ payCents: 65000, overtimeCents: 0, undertimeCents: 0 });
  });

  it("rest day, absent, leave and holiday pay nothing", () => {
    for (const status of ["rest_day", "absent", "leave", "holiday"] as const) {
      expect(computeDailyPay({ ...base, status, minutes: 0 }).payCents).toBe(0);
    }
  });

  it("present keeps its rule: undertime off by the hour, overtime at the employee's rate", () => {
    // ₱650 ÷ 8 h = ₱81.25 an hour
    expect(computeDailyPay({ ...base, status: "present", minutes: 240 })).toMatchObject({
      undertimeMinutes: 240,
      undertimeCents: 32500,
      payCents: 32500,
    });
    expect(
      computeDailyPay({ ...base, status: "present", minutes: 600, overtimeRate: 100 }),
    ).toMatchObject({ overtimeMinutes: 120, overtimeCents: 20000, payCents: 85000 });
  });
});
