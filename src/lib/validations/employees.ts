import { z } from "zod";

import { GOV_IDS, type GovId } from "@/lib/payroll/employees";
import { parseAmount } from "@/lib/payroll/money";
import { STORAGE_PATH } from "@/lib/storage";
import { dateString, optionalText } from "@/lib/validations/shared";

/** Optional government number: dashes and spaces are fine, "" → null. */
const govId = (kind: GovId) => {
  const { label, digits, example } = GOV_IDS[kind];
  return z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine(
      (v) => v === "" || new RegExp(`^\\d{${digits}}$`).test(v),
      `The ${label} has ${digits} digits, like ${example}.`,
    )
    .transform((v) => v || null);
};

export const employeeSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter the full name.").max(120),
    position: z.string().trim().min(2, "Enter the position, e.g. Photographer.").max(80),
    dateHired: dateString,
    phone: z
      .string()
      .trim()
      .max(30, "Keep this under 30 characters.")
      .refine((v) => v === "" || v.replace(/\D/g, "").length >= 7, "Enter a contact number.")
      .transform((v) => v || null),
    email: z
      .string()
      .trim()
      .max(254)
      .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address.")
      .transform((v) => v.toLowerCase() || null),
    address: optionalText(300),
    photoPath: z.string().regex(STORAGE_PATH.employeePhoto).nullable(),
    sssNo: govId("sss"),
    philhealthNo: govId("philhealth"),
    pagibigNo: govId("pagibig"),
    salaryType: z.enum(["monthly", "daily"], "Pick monthly or daily."),
    salaryRate: z.string().transform((v, ctx) => {
      const amount = parseAmount(v);
      if (amount === null || amount <= 0 || amount > 10_000_000) {
        ctx.addIssue({ code: "custom", message: "Enter the salary, like 18000 or 650.50." });
        return z.NEVER;
      }
      return amount;
    }),
  })
  .transform((v) => ({
    full_name: v.fullName,
    position: v.position,
    date_hired: v.dateHired,
    phone: v.phone,
    email: v.email,
    address: v.address,
    photo_path: v.photoPath,
    sss_no: v.sssNo,
    philhealth_no: v.philhealthNo,
    pagibig_no: v.pagibigNo,
    salary_type: v.salaryType,
    salary_rate: v.salaryRate,
  }));

export type EmployeeFormInput = z.input<typeof employeeSchema>;

export const employeeIdSchema = z.object({ id: z.uuid() });
export const setEmployeeActiveSchema = z.object({ id: z.uuid(), isActive: z.boolean() });
