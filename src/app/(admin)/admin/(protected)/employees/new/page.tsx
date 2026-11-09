import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/admin/page-header";
import { EmployeeForm } from "@/components/admin/payroll/employee-form";
import { FormSkeleton } from "@/components/admin/skeletons";
import { requireAdmin } from "@/server/auth";
import { getContributionRates } from "@/server/queries/employees";

export const metadata: Metadata = { title: "Add employee" };

export default function NewEmployeePage() {
  return (
    <>
      <PageHeader eyebrow="welcome aboard" title="Add employee" />
      <Suspense fallback={<FormSkeleton fields={6} />}>
        <NewEmployee />
      </Suspense>
    </>
  );
}

async function NewEmployee() {
  await requireAdmin();
  const rates = await getContributionRates();
  return <EmployeeForm workDays={rates.workDaysPerMonth} />;
}
