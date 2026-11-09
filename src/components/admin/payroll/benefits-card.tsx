"use client";

import Link from "next/link";
import { useState } from "react";

import { handleResult } from "@/components/admin/form-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  BENEFITS,
  cutoffShare,
  type Benefit,
  type Contribution,
} from "@/lib/payroll/contributions";
import { formatAmountExact } from "@/lib/payroll/money";
import { setEmployeeBenefit } from "@/server/actions/payroll-settings";

const BASE_LABEL: Record<Benefit, string> = {
  sss: "Monthly Salary Credit",
  philhealth: "Salary counted",
  pagibig: "Salary counted",
};

/** SSS / PhilHealth / Pag-IBIG switches with this employee's shares. Saves on each switch. */
export function BenefitsCard({
  employeeId,
  name,
  enabled: initial,
  contributions,
  monthlySalary,
}: {
  employeeId: string;
  name: string;
  enabled: Record<Benefit, boolean>;
  contributions: Record<Benefit, Contribution>;
  monthlySalary: number;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [busy, setBusy] = useState<Benefit | null>(null);

  async function toggle(benefit: Benefit, next: boolean) {
    const label = BENEFITS.find((b) => b.key === benefit)!.label;
    setEnabled((e) => ({ ...e, [benefit]: next }));
    setBusy(benefit);
    const result = await setEmployeeBenefit({ employeeId, benefit, enabled: next });
    setBusy(null);
    if (!handleResult(result, `${label} ${next ? "on" : "off"} for ${name}.`)) {
      setEnabled((e) => ({ ...e, [benefit]: !next }));
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Benefits</CardTitle>
        <CardDescription>
          Employee share, worked out from a monthly salary of {formatAmountExact(monthlySalary)}.
          Half is deducted each cut-off. Switched off = ₱0, and the payslip says “Not enrolled”.{" "}
          <Link
            href="/admin/payroll/settings"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Contribution rates
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul aria-label="Benefits" className="divide-y rounded-2xl border">
          {BENEFITS.map(({ key, label }) => {
            const c = contributions[key];
            const on = enabled[key];
            const id = `benefit-${key}`;
            return (
              <li key={key} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <label htmlFor={id} className="font-semibold">
                    {label}
                  </label>
                  {on ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatAmountExact(cutoffShare(c.monthly, 1))}
                      </span>{" "}
                      per cut-off · {formatAmountExact(c.monthly)} a month
                      <span className="block sm:inline">
                        <span className="hidden sm:inline"> · </span>
                        {BASE_LABEL[key]} {formatAmountExact(c.base)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not enrolled · ₱0</p>
                  )}
                </div>
                <Switch
                  id={id}
                  checked={on}
                  disabled={busy === key}
                  onCheckedChange={(next) => toggle(key, next)}
                />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
