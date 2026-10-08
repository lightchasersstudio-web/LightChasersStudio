import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

import { LoginForm } from "@/components/admin/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign in" };

export default function AdminLoginPage() {
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Image
            src="/brand/logo.jpg"
            alt="Light Chasers Studio"
            width={96}
            height={96}
            className="mx-auto"
            priority
          />
          <CardTitle>
            <h1 className="text-xl font-semibold">Admin sign in</h1>
          </CardTitle>
          <CardDescription>Staff access only.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* useSearchParams (the `next` / `error` params) is runtime data under Cache Components. */}
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
