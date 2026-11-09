"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { useUnsavedChangesWarning } from "@/components/admin/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import {
  cutoffShare,
  DEFAULT_RATES,
  monthlyContributions,
  type ContributionRates,
} from "@/lib/payroll/contributions";
import { amountToInput, formatAmountExact } from "@/lib/payroll/money";
import {
  contributionSettingsSchema,
  type ContributionSettingsFormInput,
} from "@/lib/validations/payroll";
import { updateContributionSettings } from "@/server/actions/payroll-settings";

const pct = (fraction: number) => String(Math.round(fraction * 10000) / 100);

function toForm(r: ContributionRates): ContributionSettingsFormInput {
  return {
    sssRate: pct(r.sssEmployeeRate),
    sssMscMin: amountToInput(r.sssMscMin),
    sssMscMax: amountToInput(r.sssMscMax),
    sssMscStep: amountToInput(r.sssMscStep),
    philhealthRate: pct(r.philhealthEmployeeRate),
    philhealthFloor: amountToInput(r.philhealthFloor),
    philhealthCeiling: amountToInput(r.philhealthCeiling),
    pagibigRate: pct(r.pagibigEmployeeRate),
    pagibigCap: amountToInput(r.pagibigSalaryCap),
    workDays: String(r.workDaysPerMonth),
  };
}

const EXAMPLE_SALARY = 20000;

export function ContributionSettingsForm({ rates }: { rates: ContributionRates }) {
  const form = useForm<
    ContributionSettingsFormInput,
    unknown,
    z.output<typeof contributionSettingsSchema>
  >({
    resolver: zodResolver(contributionSettingsSchema),
    defaultValues: toForm(rates),
  });
  const { control } = form;
  useUnsavedChangesWarning(form.formState.isDirty);
  const values = useWatch({ control });

  // Live example with whatever is typed so far (falls back to the saved value).
  const parsed = contributionSettingsSchema.safeParse({ ...toForm(rates), ...values });
  const example = parsed.success
    ? monthlyContributions(EXAMPLE_SALARY, {
        sssEmployeeRate: parsed.data.sss_employee_rate,
        sssMscMin: parsed.data.sss_msc_min,
        sssMscMax: parsed.data.sss_msc_max,
        sssMscStep: parsed.data.sss_msc_step,
        philhealthEmployeeRate: parsed.data.philhealth_employee_rate,
        philhealthFloor: parsed.data.philhealth_floor,
        philhealthCeiling: parsed.data.philhealth_ceiling,
        pagibigEmployeeRate: parsed.data.pagibig_employee_rate,
        pagibigSalaryCap: parsed.data.pagibig_salary_cap,
        workDaysPerMonth: parsed.data.work_days_per_month,
      })
    : null;

  async function onSubmit() {
    const v = form.getValues();
    const result = await updateContributionSettings(v);
    if (handleResult(result, "Contribution rates saved.", form)) form.reset(v);
  }

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
            <CardTitle>SSS</CardTitle>
            <CardDescription>
              Employee share of the Monthly Salary Credit (MSC): the salary rounded to the nearest
              step, between the lowest and highest MSC.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                control={control}
                name="sssRate"
                label="Employee share (%)"
                inputMode="decimal"
              />
              <TextField
                control={control}
                name="sssMscStep"
                label="MSC step"
                prefix="₱"
                inputMode="decimal"
              />
              <TextField
                control={control}
                name="sssMscMin"
                label="Lowest MSC"
                prefix="₱"
                inputMode="decimal"
              />
              <TextField
                control={control}
                name="sssMscMax"
                label="Highest MSC"
                prefix="₱"
                inputMode="decimal"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PhilHealth</CardTitle>
            <CardDescription>
              Employee share of the monthly salary, counting at least the floor and at most the
              ceiling.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-3">
              <TextField
                control={control}
                name="philhealthRate"
                label="Employee share (%)"
                inputMode="decimal"
              />
              <TextField
                control={control}
                name="philhealthFloor"
                label="Salary floor"
                prefix="₱"
                inputMode="decimal"
              />
              <TextField
                control={control}
                name="philhealthCeiling"
                label="Salary ceiling"
                prefix="₱"
                inputMode="decimal"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pag-IBIG</CardTitle>
            <CardDescription>
              Employee share of the monthly salary, counting up to the cap (2% of ₱10,000 = ₱200 at
              most).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                control={control}
                name="pagibigRate"
                label="Employee share (%)"
                inputMode="decimal"
              />
              <TextField
                control={control}
                name="pagibigCap"
                label="Salary cap"
                prefix="₱"
                inputMode="decimal"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Working days</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <TextField
                control={control}
                name="workDays"
                label="Working days in a month"
                inputMode="decimal"
                className="max-w-xs"
                description="Daily rate = monthly salary ÷ this (for absences). A daily-paid employee's monthly salary = daily rate × this (for contributions). 26 = Monday to Saturday."
              />
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <Card className="lg:col-start-2 lg:row-start-1 lg:self-start">
        <CardHeader>
          <CardTitle>Example</CardTitle>
          <CardDescription>
            Employee share for a {formatAmountExact(EXAMPLE_SALARY)} monthly salary.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {example ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="pb-2 text-left font-normal">
                    <span className="sr-only">Contribution</span>
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    Month
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    Cut-off
                  </th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["SSS", example.sss.monthly],
                    ["PhilHealth", example.philhealth.monthly],
                    ["Pag-IBIG", example.pagibig.monthly],
                  ] as const
                ).map(([label, monthly]) => (
                  <tr key={label}>
                    <th scope="row" className="py-1 text-left font-normal text-muted-foreground">
                      {label}
                    </th>
                    <td className="py-1 text-right tabular-nums">{formatAmountExact(monthly)}</td>
                    <td className="py-1 text-right font-semibold tabular-nums">
                      {formatAmountExact(cutoffShare(monthly, 1))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">Fix the highlighted fields to see it.</p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => form.reset(toForm(DEFAULT_RATES), { keepDefaultValues: true })}
          >
            Use the 2026 rates
          </Button>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex gap-2 rounded-full border bg-background/90 p-2 shadow-lg backdrop-blur lg:static lg:col-start-2 lg:row-start-2 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          Save rates
        </Button>
      </div>
    </form>
  );
}
