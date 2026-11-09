import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/admin/page-header";
import { ContributionSettingsForm } from "@/components/admin/payroll/contribution-settings-form";
import { FormSkeleton } from "@/components/admin/skeletons";
import { requireAdmin } from "@/server/auth";
import { getContributionRates } from "@/server/queries/employees";

export const metadata: Metadata = { title: "Contribution rates" };

export default function ContributionRatesPage() {
  return (
    <>
      <PageHeader
        eyebrow="payroll"
        title="Contribution rates"
        description="Employee shares for SSS, PhilHealth and Pag-IBIG, set to the 2026 rates. Change them here when the agencies update theirs. Saved payslips keep the amounts they were made with."
      />
      <Suspense fallback={<FormSkeleton fields={8} />}>
        <Rates />
      </Suspense>
    </>
  );
}

async function Rates() {
  await requireAdmin();
  return <ContributionSettingsForm rates={await getContributionRates()} />;
}
