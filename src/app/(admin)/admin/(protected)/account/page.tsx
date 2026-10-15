import type { Metadata } from "next";
import { Suspense } from "react";

import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { PageHeader } from "@/components/admin/page-header";
import { FormSkeleton } from "@/components/admin/skeletons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <>
      <PageHeader eyebrow="just you" title="Your account" />
      <Suspense fallback={<FormSkeleton fields={3} className="max-w-2xl" />}>
        <Account />
      </Suspense>
    </>
  );
}

async function Account() {
  const admin = await requireAdmin();
  return (
    <>
      <p className="-mt-4 mb-6 text-muted-foreground">
        Signed in as {admin.email ?? "admin"} ({admin.role}).
      </p>
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
