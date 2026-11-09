"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { SelectField, TextAreaField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { EmployeePhotoField } from "@/components/admin/payroll/employee-photo-field";
import { useUnsavedChangesWarning } from "@/components/admin/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import {
  asSalaryType,
  formatGovId,
  GOV_IDS,
  SALARY_TYPES,
  salaryRates,
} from "@/lib/payroll/employees";
import { amountToInput, formatAmount, parseAmount } from "@/lib/payroll/money";
import { businessToday } from "@/lib/utils/business-date";
import { employeeSchema, type EmployeeFormInput } from "@/lib/validations/employees";
import { createEmployee, updateEmployee } from "@/server/actions/employees";
import type { EmployeeWithPhoto } from "@/server/queries/employees";

export function EmployeeForm({
  employee,
  workDays,
  hoursPerDay,
}: {
  employee?: EmployeeWithPhoto;
  workDays: number;
  hoursPerDay: number;
}) {
  const router = useRouter();
  const form = useForm<EmployeeFormInput, unknown, z.output<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: employee
      ? {
          fullName: employee.full_name,
          position: employee.position,
          dateHired: employee.date_hired,
          phone: employee.phone ?? "",
          email: employee.email ?? "",
          address: employee.address ?? "",
          photoPath: employee.photo_path,
          sssNo: formatGovId("sss", employee.sss_no) ?? "",
          philhealthNo: formatGovId("philhealth", employee.philhealth_no) ?? "",
          pagibigNo: formatGovId("pagibig", employee.pagibig_no) ?? "",
          salaryType: asSalaryType(employee.salary_type),
          salaryRate: amountToInput(Number(employee.salary_rate)),
          overtimeRate:
            employee.overtime_rate === null ? "" : amountToInput(Number(employee.overtime_rate)),
        }
      : {
          fullName: "",
          position: "",
          dateHired: businessToday(),
          phone: "",
          email: "",
          address: "",
          photoPath: null,
          sssNo: "",
          philhealthNo: "",
          pagibigNo: "",
          salaryType: "monthly",
          salaryRate: "",
          overtimeRate: "",
        },
  });
  const { control } = form;
  useUnsavedChangesWarning(form.formState.isDirty);
  const [salaryType, salaryRate] = useWatch({ control, name: ["salaryType", "salaryRate"] });

  async function onSubmit() {
    const values = form.getValues();
    if (employee) {
      const result = await updateEmployee(employee.id, values);
      if (handleResult(result, "Employee saved.", form)) form.reset(values);
    } else {
      const result = await createEmployee(values);
      if (handleResult(result, "Employee added.", form)) {
        form.reset(values); // nothing unsaved: don't ask before leaving
        router.push(`/admin/employees/${result.data.id}`);
      }
    }
  }

  const type = asSalaryType(salaryType);
  const rate = parseAmount(salaryRate ?? "");
  const rates = rate ? salaryRates(type, rate, workDays) : null;
  const hourly = rates ? Math.round((rates.daily * 100) / hoursPerDay) / 100 : null;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, (errors) =>
        toast.error(
          Object.values(errors).find((e) => e?.message)?.message ??
            "Please check the highlighted fields.",
        ),
      )}
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:grid-rows-[auto_1fr]"
    >
      <div className="space-y-6 lg:row-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Controller
                control={control}
                name="photoPath"
                render={({ field }) => (
                  <EmployeePhotoField
                    value={field.value}
                    initialUrl={employee?.photoUrl ?? null}
                    onChange={field.onChange}
                  />
                )}
              />
              <TextField control={control} name="fullName" label="Full name" autoComplete="off" />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  control={control}
                  name="position"
                  label="Position"
                  placeholder="e.g. Photographer"
                />
                <TextField control={control} name="dateHired" label="Date hired" type="date" />
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  control={control}
                  name="phone"
                  label="Contact no."
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="0917 123 4567"
                />
                <TextField
                  control={control}
                  name="email"
                  label="Email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                />
              </div>
              <TextAreaField
                control={control}
                name="address"
                label="Address"
                rows={2}
                maxLength={300}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Government numbers</CardTitle>
            <CardDescription>Optional. Dashes are added for you.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-3">
              <TextField
                control={control}
                name="sssNo"
                label={GOV_IDS.sss.label}
                inputMode="numeric"
                autoComplete="off"
                placeholder={GOV_IDS.sss.example}
              />
              <TextField
                control={control}
                name="philhealthNo"
                label={GOV_IDS.philhealth.label}
                inputMode="numeric"
                autoComplete="off"
                placeholder={GOV_IDS.philhealth.example}
              />
              <TextField
                control={control}
                name="pagibigNo"
                label={GOV_IDS.pagibig.label}
                inputMode="numeric"
                autoComplete="off"
                placeholder={GOV_IDS.pagibig.example}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="lg:col-start-2 lg:row-start-1 lg:self-start">
        <CardHeader>
          <CardTitle>Salary</CardTitle>
          <CardDescription>
            Paid twice a month: the 1st–15th and the 16th–end of month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SelectField
              control={control}
              name="salaryType"
              label="Paid by"
              options={SALARY_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
            <TextField
              control={control}
              name="salaryRate"
              label={type === "monthly" ? "Monthly salary" : "Daily rate"}
              prefix="₱"
              inputMode="decimal"
              autoComplete="off"
              description={employee ? "Changes apply to payrolls you save from now on." : undefined}
            />
            {rates && (
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-2xl bg-muted/60 p-4 text-sm">
                {type === "monthly" ? (
                  <>
                    <dt className="text-muted-foreground">Per cut-off</dt>
                    <dd className="text-right font-semibold tabular-nums">
                      {formatAmount(rates.monthly / 2)}
                    </dd>
                    <dt className="text-muted-foreground">Daily rate (÷ {workDays} days)</dt>
                    <dd className="text-right font-semibold tabular-nums">
                      {formatAmount(rates.daily)}
                    </dd>
                  </>
                ) : (
                  <>
                    <dt className="text-muted-foreground">
                      Monthly, for contributions (× {workDays} days)
                    </dt>
                    <dd className="text-right font-semibold tabular-nums">
                      {formatAmount(rates.monthly)}
                    </dd>
                  </>
                )}
                {hourly !== null && (
                  <>
                    <dt className="text-muted-foreground">Hourly rate (÷ {hoursPerDay} hours)</dt>
                    <dd className="text-right font-semibold tabular-nums">
                      {formatAmount(hourly)}
                    </dd>
                  </>
                )}
              </dl>
            )}
            <TextField
              control={control}
              name="overtimeRate"
              label="Overtime pay per hour"
              prefix="₱"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Not paid"
              description={`For time past ${hoursPerDay} hours in a day. Leave empty if overtime isn't paid.`}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex gap-2 rounded-full border bg-background/90 p-2 shadow-lg backdrop-blur lg:static lg:col-start-2 lg:row-start-2 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={() => router.push("/admin/employees")}
        >
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          {employee ? "Save changes" : "Add employee"}
        </Button>
      </div>
    </form>
  );
}
