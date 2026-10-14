import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const admin = await requireAdmin();

  return (
    <>
      <PageHeader
        eyebrow="just you"
        title="Your account"
        description={`Signed in as ${admin.email ?? "admin"} (${admin.role}).`}
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>You&apos;ll stay signed in on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          {admin.email ? (
            <ChangePasswordForm email={admin.email} />
          ) : (
            <p className="text-sm text-muted-foreground">This account has no email address.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
