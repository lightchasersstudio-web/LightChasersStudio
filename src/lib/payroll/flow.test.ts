import { describe, expect, it } from "vitest";

import { mergePastPayslips, pastCutoffWarning, payrollChanged } from "./flow";
import type { Payslip } from "./payslip";

const slip = (id: string, days: number) =>
  ({ employee_id: id, days_present: days, net_pay: days * 500 }) as unknown as Payslip;

describe("payrollChanged", () => {
  it("is false when nothing was saved yet", () => {
    expect(payrollChanged([slip("a", 1)], null)).toBe(false);
  });

  it("ignores the order of payslips", () => {
    expect(payrollChanged([slip("a", 1), slip("b", 2)], [slip("b", 2), slip("a", 1)])).toBe(false);
  });

  it("notices a changed figure or a new person", () => {
    expect(payrollChanged([slip("a", 2)], [slip("a", 1)])).toBe(true);
    expect(payrollChanged([slip("a", 1), slip("b", 1)], [slip("a", 1)])).toBe(true);
  });
});

describe("mergePastPayslips", () => {
  const named = (id: string, name: string, net: number) =>
    ({ employee_id: id, employee_name: name, net_pay: net }) as unknown as Payslip;
  const saved = [named("a", "Ana", 100), named("b", "Ben", 200), named("y", "Yahya", 300)];
  // Yahya was deactivated since, and Ben got a raise: neither was edited.
  const fresh = [named("a", "Ana", 150), named("b", "Ben", 999), named("c", "Cora", 50)];

  it("redoes only the edited people and keeps everyone else as saved", () => {
    expect(mergePastPayslips(saved, fresh, ["a"]).map((p) => [p.employee_name, p.net_pay])).toEqual(
      [
        ["Ana", 150],
        ["Ben", 200],
        ["Yahya", 300],
      ],
    );
  });

  it("adds an edited person who had no payslip there yet", () => {
    expect(mergePastPayslips(saved, fresh, ["c"]).map((p) => p.employee_name)).toEqual([
      "Ana",
      "Ben",
      "Cora",
      "Yahya",
    ]);
  });

  it("keeps the saved payslip of an edited person who is no longer active", () => {
    expect(mergePastPayslips(saved, fresh, ["y"]).find((p) => p.employee_id === "y")?.net_pay).toBe(
      300,
    );
  });
});

describe("pastCutoffWarning", () => {
  it("names whose payslip changes", () => {
    expect(pastCutoffWarning("Nov 1–15, 2026", ["Ana", "Ben", "Cora"])).toBe(
      "Nov 1–15, 2026 is already over and paid. Saving changes the payslip of Ana, Ben and Cora. Everyone else's payslip stays as it was saved. Continue?",
    );
    expect(pastCutoffWarning("Nov 1–15, 2026", ["Ana"])).toContain("payslip of Ana.");
  });
});
