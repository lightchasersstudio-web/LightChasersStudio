import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/admin/page-header";
import { ContributionSettingsForm } from "@/components/admin/payroll/contribution-settings-form";
import { FormSkeleton } from "@/components/admin/skeletons";
import { requireAdmin } from "@/server/auth";
import { getContributionRates } from "@/server/queries/employees";

export const metadata: Metadata = { title: "Payroll settings" };

export default function PayrollSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="payroll"
        title="Payroll settings"
        description="Work hours for everyone, and the employee shares for SSS, PhilHealth and Pag-IBIG (set to the 2026 rates). Overtime pay is set per employee, on their page. Saved payslips keep the amounts they were made with."
      />
      <Suspense fallback={<FormSkeleton fields={8} />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  await requireAdmin();
  return <ContributionSettingsForm rates={await getContributionRates()} />;
}
