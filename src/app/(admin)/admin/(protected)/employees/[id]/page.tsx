import { differenceInCalendarMonths, format } from "date-fns";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { FormSkeleton } from "@/components/admin/skeletons";
import { EmployeeAvatar } from "@/components/admin/payroll/employee-avatar";
import { EmployeeForm } from "@/components/admin/payroll/employee-form";
import { EmployeeStatusButton } from "@/components/admin/payroll/employee-status-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { businessToday, tzDate } from "@/lib/utils/business-date";
import { requireAdmin } from "@/server/auth";
import { BenefitsCard } from "@/components/admin/payroll/benefits-card";
import { monthlyContributions } from "@/lib/payroll/contributions";
import { asSalaryType, salaryRates } from "@/lib/payroll/employees";
import { getContributionRates, getEmployee } from "@/server/queries/employees";

export const metadata: Metadata = { title: "Employee" };

export default function EmployeePage({ params }: PageProps<"/admin/employees/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <Skeleton className="h-20 w-80" />
          <FormSkeleton fields={6} />
        </div>
      }
    >
      <Employee params={params} />
    </Suspense>
  );
}

/** "2 years 3 months", "5 months", "new" */
function tenure(dateHired: string): string {
  const months = differenceInCalendarMonths(tzDate(businessToday()), tzDate(dateHired));
  if (months < 1) return "new";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [
    years && `${years} ${years === 1 ? "year" : "years"}`,
    rest && `${rest} ${rest === 1 ? "month" : "months"}`,
  ].filter(Boolean);
  return parts.join(" ");
}

async function Employee({ params }: Pick<PageProps<"/admin/employees/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [employee, rates] = await Promise.all([getEmployee(id), getContributionRates()]);
  if (!employee) notFound();
  const workDays = rates.workDaysPerMonth;
  const { monthly } = salaryRates(
    asSalaryType(employee.salary_type),
    Number(employee.salary_rate),
    workDays,
  );

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <EmployeeAvatar
            name={employee.full_name}
            photoUrl={employee.photoUrl}
            className="size-16 text-xl"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-3xl font-semibold">{employee.full_name}</h1>
              {!employee.is_active && <Badge variant="secondary">Inactive</Badge>}
            </div>
            <p className="text-muted-foreground">
              {employee.position} · since {format(tzDate(employee.date_hired), "d MMM yyyy")} (
              {tenure(employee.date_hired)})
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <EmployeeStatusButton
            id={employee.id}
            name={employee.full_name}
            isActive={employee.is_active}
          />
        </div>
      </header>
      {/* key: reset the form when navigating between employees */}
      <EmployeeForm key={employee.id} employee={employee} workDays={workDays} />
      <BenefitsCard
        // key: new figures after a salary change, fresh switches for another employee
        key={`${employee.id}-${monthly}`}
        employeeId={employee.id}
        name={employee.full_name}
        enabled={{
          sss: employee.benefits?.sss_enabled ?? true,
          philhealth: employee.benefits?.philhealth_enabled ?? true,
          pagibig: employee.benefits?.pagibig_enabled ?? true,
        }}
        contributions={monthlyContributions(monthly, rates)}
        monthlySalary={monthly}
      />
    </>
  );
}
