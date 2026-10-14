"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { TextField } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/browser";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/settings";

/**
 * Runs in the browser (like login) so Supabase's per-IP rate limits apply to the
 * admin's real IP. Re-entering the current password stops someone at an
 * unlocked laptop from taking over the account.
 */
export function ChangePasswordForm({ email }: { email: string }) {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: values.currentPassword,
    });
    if (authError) {
      form.setError("currentPassword", {
        message:
          authError.status === 429
            ? "Too many attempts. Try again in a few minutes."
            : "That's not your current password.",
      });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: values.newPassword });
    if (error) {
      // e.g. Supabase's leaked-password or strength checks
      form.setError("newPassword", { message: error.message });
      return;
    }
    toast.success("Password changed.");
    form.reset();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="max-w-md">
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <FieldGroup>
        <TextField
          control={form.control}
          name="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
        />
        <TextField
          control={form.control}
          name="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          description="At least 10 characters. A short phrase is easy to remember and hard to guess."
        />
        <TextField
          control={form.control}
          name="confirmPassword"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
        />
        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          Change password
        </Button>
      </FieldGroup>
    </form>
  );
}
