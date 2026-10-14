import type { Metadata } from "next";
import { LockIcon } from "lucide-react";
import Image from "next/image";
import { Suspense } from "react";

import { LoginCollage } from "@/components/admin/login-collage";
import { LoginForm } from "@/components/admin/login-form";
import { Sparkle } from "@/components/shared/sparkle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign in" };

export default function AdminLoginPage() {
  return (
    <main id="main" className="grid flex-1 md:grid-cols-2 [@media(max-height:640px)]:grid-cols-1">
      <LoginCollage />

      <div className="flex items-center justify-center bg-studio px-4 py-10 sm:px-8 sm:py-16">
        <div className="w-full max-w-sm">
          {/* Logo as a slightly tilted polaroid. */}
          <div className="relative z-10 mx-auto -mb-10 w-32 -rotate-3 animate-in duration-500 fill-mode-both fade-in slide-in-from-top-4 sm:w-40">
            <div className="polaroid pb-8">
              <Image
                src="/brand/logo.jpg"
                alt="Light Chasers Studio"
                width={136}
                height={136}
                sizes="(min-width: 640px) 136px, 104px"
                className="mx-auto"
                priority
              />
              <p className="absolute inset-x-0 bottom-1.5 text-center font-script text-lg">
                say cheese!
              </p>
            </div>
          </div>

          <Card className="animate-in pt-14 shadow-lg delay-150 duration-500 fill-mode-both fade-in slide-in-from-bottom-4">
            <CardHeader className="items-center text-center">
              <CardTitle>
                <h1 className="flex items-center justify-center gap-2 text-2xl font-semibold sm:text-3xl">
                  <Sparkle className="size-3.5 text-terracotta" />
                  Welcome back
                  <Sparkle className="size-3.5 text-terracotta" />
                </h1>
              </CardTitle>
              <CardDescription>Sign in to the studio admin. Staff only.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* useSearchParams (the `next` / `error` params) is runtime data under Cache Components. */}
              <Suspense fallback={<LoginFormSkeleton />}>
                <LoginForm />
              </Suspense>
            </CardContent>
          </Card>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <LockIcon className="size-3.5" aria-hidden />
            Protected area · Light Chasers Studio
          </p>
        </div>
      </div>
    </main>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-[4.5rem] w-full" />
      <Skeleton className="h-[4.5rem] w-full" />
      <Skeleton className="h-10 w-full rounded-full" />
    </div>
  );
}
