import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/admin/page-header";
import { BookingRulesForm, LogoForm, StudioProfileForm } from "@/components/admin/settings-forms";
import { FormSkeleton } from "@/components/admin/skeletons";
import { requireAdmin } from "@/server/auth";
import { getBusinessSettingsForAdmin } from "@/server/queries/settings";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="the studio"
        title="Settings"
        description="Your studio profile, booking rules and logo."
      />
      <Suspense
        fallback={
          <div className="grid gap-6 xl:grid-cols-[1fr_20rem] xl:items-start">
            <FormSkeleton fields={6} />
            <FormSkeleton fields={1} />
          </div>
        }
      >
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  await requireAdmin();
  const settings = await getBusinessSettingsForAdmin();
  return (
    <>
      <p className="-mt-4 mb-6 text-sm text-muted-foreground">
        Timezone: {settings.timezone} · Currency: {settings.currency}
      </p>
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem] xl:items-start">
        <div className="space-y-6">
          <StudioProfileForm settings={settings} />
          <BookingRulesForm settings={settings} />
        </div>
        <LogoForm logoPath={settings.logo_path} />
      </div>
    </>
  );
}
