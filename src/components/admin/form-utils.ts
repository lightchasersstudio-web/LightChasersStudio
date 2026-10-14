"use client";

import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/utils/action-result";

/**
 * Shows a server action's result: success toast, or field errors on the form
 * (the server re-validates with the same zod schema) plus an error toast.
 */
export function handleResult<T, F extends FieldValues>(
  result: ActionResult<T>,
  success: string,
  form?: UseFormReturn<F, unknown, unknown>,
): result is { ok: true; data: T } {
  if (result.ok) {
    if (success) toast.success(success); // "" = silent (e.g. reordering)
    return true;
  }
  if (form && result.fieldErrors) {
    for (const [name, messages] of Object.entries(result.fieldErrors)) {
      if (messages?.[0])
        form.setError(name as Path<F>, { message: messages[0] }, { shouldFocus: true });
    }
  }
  toast.error(result.error);
  return false;
}
