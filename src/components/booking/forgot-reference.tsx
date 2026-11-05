"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, MailCheckIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { Button } from "@/components/ui/button";
import { remindSchema } from "@/lib/validations/booking";
import { emailMyBookings } from "@/server/actions/booking";

/** "Lost your reference?": sends the bookings made with an email to that inbox. */
export function ForgotReference() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<z.input<typeof remindSchema>, unknown, z.output<typeof remindSchema>>({
    resolver: zodResolver(remindSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.output<typeof remindSchema>) {
    const result = await emailMyBookings(values);
    if (handleResult(result, "", form)) setSentTo(result.data.email);
  }

  if (sentTo) {
    return (
      <div role="status" className="rounded-2xl bg-sage/25 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <MailCheckIcon className="size-5" aria-hidden />
          Check your inbox
        </p>
        <p className="mt-1">
          If any bookings were made with <strong>{sentTo}</strong>, we&apos;ve just emailed their
          references there. Not there in a few minutes? Look in Spam or Promotions.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      <TextField
        control={form.control}
        name="email"
        label="Email you booked with"
        type="email"
        autoComplete="email"
      />
      <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
        Email me my booking references
      </Button>
    </form>
  );
}
