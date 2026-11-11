import { describe, expect, it } from "vitest";

import { missingDays, nextStep, staffComplete, stepDone, type PayrollFlow } from "./flow";

const flow = (over: Partial<PayrollFlow> = {}): PayrollFlow => ({
  staff: 3,
  staffComplete: 1,
  savedAt: null,
  changed: false,
  ...over,
});

describe("payroll flow", () => {
  it("counts staff with every day recorded", () => {
    expect(staffComplete([{ recorded: 15 }, { recorded: 14 }, { recorded: 16 }], 15)).toBe(2);
  });

  it("starts with recording days", () => {
    expect(nextStep(flow())).toBe("record");
    expect(stepDone(flow({ staff: 0, staffComplete: 0 }), "record")).toBe(false);
  });

  it("moves to the payroll once every day is recorded", () => {
    expect(nextStep(flow({ staffComplete: 3 }))).toBe("payroll");
  });

  it("moves to payslips once the payroll is saved, even mid cut-off", () => {
    expect(nextStep(flow({ savedAt: "2026-11-10T08:00:00Z" }))).toBe("payslips");
  });

  it("goes back to the payroll when things changed since saving", () => {
    const changed = flow({ staffComplete: 3, savedAt: "2026-11-10T08:00:00Z", changed: true });
    expect(stepDone(changed, "payroll")).toBe(false);
    expect(nextStep(changed)).toBe("payroll");
  });
});

describe("missingDays", () => {
  const dates = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"];
  const rows = [
    { id: "a", name: "Ana", dates: ["2026-11-01", "2026-11-02", "2026-11-03"] },
    { id: "b", name: "Ben", dates: ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"] },
    { id: "c", name: "Cy", dates: ["2026-11-02"] },
  ];

  it("lists blank days up to today only", () => {
    expect(missingDays(rows, dates, "2026-11-03")).toEqual([
      { id: "c", name: "Cy", dates: ["2026-11-01", "2026-11-03"] },
    ]);
  });

  it("checks every day once the cut-off is over", () => {
    expect(missingDays(rows, dates, "2026-11-20").map((m) => [m.name, m.dates.length])).toEqual([
      ["Ana", 1],
      ["Cy", 3],
    ]);
  });
});
