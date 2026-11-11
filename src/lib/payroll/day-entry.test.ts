import { describe, expect, it } from "vitest";

import { afterStatusChange, timeOutForNewTimeIn } from "./day-entry";

const rates = { current: "650", amPm: "650.50" };
const blank = { status: "", timeIn: "", timeOut: "", rate: "" };

describe("afterStatusChange", () => {
  it("fills a shift's usual times and the employee's rate", () => {
    expect(afterStatusChange(blank, "pm", rates)).toEqual({
      status: "pm",
      timeIn: "14:00",
      timeOut: "22:00",
      rate: "650",
    });
  });

  it("puts in the AM/PM rate and gives the employee's rate back after", () => {
    const amPm = afterStatusChange(blank, "am_pm", rates);
    expect(amPm).toMatchObject({ timeIn: "09:30", timeOut: "22:00", rate: "650.50" });
    expect(afterStatusChange(amPm, "present", rates).rate).toBe("650");
  });

  it("keeps a rate typed by hand", () => {
    const day = { status: "present", timeIn: "09:00", timeOut: "17:00", rate: "800" };
    expect(afterStatusChange(day, "am", rates).rate).toBe("800");
  });

  it("clears the times for a day without them, keeps them for present", () => {
    const day = { status: "present", timeIn: "09:00", timeOut: "17:00", rate: "650" };
    expect(afterStatusChange(day, "rest_day", rates)).toMatchObject({ timeIn: "", timeOut: "" });
    expect(afterStatusChange(day, "present", rates)).toMatchObject({
      timeIn: "09:00",
      timeOut: "17:00",
    });
  });
});

describe("timeOutForNewTimeIn", () => {
  it("moves a shift's time out, leaves present alone", () => {
    expect(timeOutForNewTimeIn("am", "10:00")).toBe("18:00");
    expect(timeOutForNewTimeIn("present", "10:00")).toBeNull();
  });
});
