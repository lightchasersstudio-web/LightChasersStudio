import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { BookingRulesForm, LogoForm, StudioProfileForm } from "@/components/admin/settings-forms";
import { requireAdmin } from "@/server/auth";
import { getBusinessSettingsForAdmin } from "@/server/queries/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await getBusinessSettingsForAdmin();

  return (
    <>
      <PageHeader
        eyebrow="the studio"
        title="Settings"
        description={`Timezone: ${settings.timezone} · Currency: ${settings.currency}`}
      />
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
