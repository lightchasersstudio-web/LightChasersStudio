import { describe, expect, it } from "vitest";

import { formatGovId, salaryRates } from "@/lib/payroll/employees";
import { amountToInput, formatAmount, formatAmountExact, parseAmount } from "@/lib/payroll/money";
import { employeeSchema, type EmployeeFormInput } from "@/lib/validations/employees";

const base: EmployeeFormInput = {
  fullName: "  Ana Cruz ",
  position: "Photographer",
  dateHired: "2026-01-05",
  phone: "",
  email: "",
  address: "",
  photoPath: null,
  sssNo: "",
  philhealthNo: "",
  pagibigNo: "",
  salaryType: "monthly",
  salaryRate: "18,000",
  overtimeRate: "",
};

describe("employeeSchema", () => {
  it("turns the form into a row, empty optional fields becoming null", () => {
    expect(employeeSchema.parse(base)).toEqual({
      full_name: "Ana Cruz",
      position: "Photographer",
      date_hired: "2026-01-05",
      phone: null,
      email: null,
      address: null,
      photo_path: null,
      sss_no: null,
      philhealth_no: null,
      pagibig_no: null,
      salary_type: "monthly",
      salary_rate: 18000,
      overtime_rate: null,
    });
  });

  it("accepts government numbers with dashes and stores digits", () => {
    const row = employeeSchema.parse({
      ...base,
      sssNo: "34-1234567-8",
      philhealthNo: "12 345678901 2",
      pagibigNo: "1234-5678-9012",
      email: "Ana@Example.com",
      salaryType: "daily",
      salaryRate: "650.50",
      overtimeRate: "125",
    });
    expect(row).toMatchObject({
      sss_no: "3412345678",
      philhealth_no: "123456789012",
      pagibig_no: "123456789012",
      email: "ana@example.com",
      salary_type: "daily",
      salary_rate: 650.5,
      overtime_rate: 125,
    });
  });

  it("explains what's wrong", () => {
    const result = employeeSchema.safeParse({
      ...base,
      sssNo: "34-123",
      salaryRate: "0",
      email: "nope",
      photoPath: "../evil.png",
      overtimeRate: "lots",
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths.sort()).toEqual(["email", "overtimeRate", "photoPath", "salaryRate", "sssNo"]);
    expect(result.error!.issues.find((i) => i.path[0] === "sssNo")?.message).toMatch(/10 digits/);
  });
});

describe("payroll helpers", () => {
  it("formats government numbers", () => {
    expect(formatGovId("sss", "3412345678")).toBe("34-1234567-8");
    expect(formatGovId("philhealth", "123456789012")).toBe("12-345678901-2");
    expect(formatGovId("pagibig", "123456789012")).toBe("1234-5678-9012");
    expect(formatGovId("sss", null)).toBeNull();
  });

  it("converts between monthly and daily rates", () => {
    expect(salaryRates("monthly", 20000, 26)).toEqual({ monthly: 20000, daily: 769.23 });
    expect(salaryRates("daily", 650.5, 26)).toEqual({ monthly: 16913, daily: 650.5 });
  });

  it("parses and formats peso amounts", () => {
    expect(parseAmount("1,500.5")).toBe(1500.5);
    expect(parseAmount("abc")).toBeNull();
    expect(amountToInput(1500.5)).toBe("1500.50");
    expect(formatAmount(1500)).toBe("₱1,500");
    expect(formatAmountExact(1500)).toBe("₱1,500.00");
    expect(formatAmountExact(-12.5)).toBe("−₱12.50");
  });
});
