"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";
import { safeAdminRedirect } from "@/lib/utils/safe-redirect";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { signOut } from "@/server/actions/auth";

const noopSubscribe = () => () => {};

/**
 * Signs in from the browser so Supabase Auth's per-IP rate limiting applies to
 * the real client IP (a server action would funnel every attempt through the
 * server's IP). Admin status is then enforced server-side by the (protected) gate.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forbidden = searchParams.get("error") === "forbidden";
  const [formError, setFormError] = useState<string | null>(null);
  // False in the server HTML, true once React has hydrated. Until then a submit
  // would be a native form post, bypassing onSubmit.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      // Same message for every failure: don't reveal which emails have accounts.
      setFormError(
        error.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : "Incorrect email or password.",
      );
      return;
    }
    router.replace(safeAdminRedirect(searchParams.get("next")));
    router.refresh();
  }

  if (forbidden) {
    return (
      <div className="space-y-4" role="alert">
        <p className="text-sm">
          This account doesn&apos;t have admin access. Sign out and use an admin account.
        </p>
        <form action={signOut}>
          <Button type="submit" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    );
  }

  return (
    // method="post" so a submit that somehow happens before hydration never puts
    // the password in the URL (browser history, server logs).
    <form method="post" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                {...field}
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {formError && <FieldError>{formError}</FieldError>}
        <Button
          type="submit"
          className="w-full"
          disabled={!hydrated || form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          Sign in
        </Button>
      </FieldGroup>
    </form>
  );
}
