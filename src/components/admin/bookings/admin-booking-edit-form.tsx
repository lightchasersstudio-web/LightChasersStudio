"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangleIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import type { z } from "zod";

import {
  AddOnsEditor,
  timeAddOnIds,
  type AddOnChoice,
} from "@/components/admin/bookings/add-ons-editor";
import type { PackageChoice } from "@/components/admin/bookings/admin-booking-form";
import { BookingTotals } from "@/components/admin/bookings/booking-totals";
import { ScheduleField } from "@/components/admin/bookings/schedule-field";
import { SelectField, TextAreaField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { useUnsavedChangesWarning } from "@/components/admin/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { centsToPesoInput } from "@/lib/utils/money";
import {
  adminBookingEditSchema,
  type AdminBookingEditInput,
} from "@/lib/validations/admin-booking";
import { CONTACT_METHODS } from "@/lib/validations/booking";
import { updateAdminBooking } from "@/server/actions/admin-bookings";

type EditOutput = z.output<typeof adminBookingEditSchema>;

/** Change an existing booking: package, price, add-ons, VAT, time and details. */
export function AdminBookingEditForm({
  initial,
  packages,
  addOnCatalog,
  vatPercent,
  paidCents,
  hasEmail,
}: {
  initial: AdminBookingEditInput;
  packages: PackageChoice[];
  addOnCatalog: AddOnChoice[];
  vatPercent: number;
  paidCents: number;
  hasEmail: boolean;
}) {
  const router = useRouter();
  const [outsideWarning, setOutsideWarning] = useState<string | null>(null);
  const form = useForm<AdminBookingEditInput, unknown, EditOutput>({
    resolver: zodResolver(adminBookingEditSchema),
    defaultValues: initial,
  });
  useUnsavedChangesWarning(form.formState.isDirty);
  const [serviceId, price, addOns, chargeVat] = useWatch({
    control: form.control,
    name: ["serviceId", "price", "addOns", "chargeVat"],
  });

  // Switching package starts from its listed price; the booking's own price stays until then.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const pkg = packages.find((p) => p.id === serviceId);
    if (pkg) form.setValue("price", centsToPesoInput(pkg.priceCents), { shouldDirty: true });
  }, [serviceId, packages, form]);

  async function save(allowOutsideHours: boolean) {
    form.setValue("allowOutsideHours", allowOutsideHours);
    const result = await updateAdminBooking(form.getValues());
    if (!result.ok && result.fieldErrors?.allowOutsideHours) {
      setOutsideWarning(result.error);
      return;
    }
    setOutsideWarning(null);
    if (handleResult(result, "Booking updated.", form)) {
      form.reset(form.getValues()); // clear "unsaved changes" before leaving
      router.push(`/admin/bookings/${initial.bookingId}`);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(() => save(false))} noValidate className="space-y-10">
      <Section title="Package & price">
        <div className="grid gap-6 sm:grid-cols-[1fr_12rem]">
          <SelectField
            control={form.control}
            name="serviceId"
            label="Package"
            options={packages.map((p) => ({
              value: p.id,
              label: p.active ? p.name : `${p.name} (hidden)`,
            }))}
            description="Changing the package resets its price."
          />
          <TextField
            control={form.control}
            name="price"
            label="Package price"
            prefix="₱"
            inputMode="decimal"
          />
        </div>
      </Section>

      <Section title="Add-ons">
        <AddOnsEditor control={form.control} catalog={addOnCatalog} serviceId={serviceId} />
        {vatPercent > 0 && (
          <Checkbox control={form.control} name="chargeVat">
            Charge {vatPercent}% VAT on this booking
          </Checkbox>
        )}
        <BookingTotals
          packagePrice={price}
          addOns={addOns}
          vatPercent={vatPercent}
          chargeVat={chargeVat}
          paidCents={paidCents}
        />
      </Section>

      <Section title="Date & time">
        <ScheduleField
          form={form}
          addOnIds={timeAddOnIds(addOns, addOnCatalog)}
          initialDate={initial.date}
          excludeBookingId={initial.bookingId}
        />
      </Section>

      <Section title="Client">
        <FieldGroup>
          <TextField control={form.control} name="fullName" label="Name" autoComplete="off" />
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField control={form.control} name="phone" label="Mobile number" type="tel" />
            <SelectField
              control={form.control}
              name="preferredContact"
              label="Best way to reach them"
              options={[...CONTACT_METHODS]}
            />
          </div>
          <TextField
            control={form.control}
            name="messenger"
            label="Facebook name or Messenger link"
            placeholder="https://m.me/…"
          />
        </FieldGroup>
      </Section>

      <Section title="Shoot details">
        <FieldGroup>
          <div className="grid gap-6 sm:grid-cols-[1fr_10rem]">
            <TextField control={form.control} name="location" label="Location (optional)" />
            <TextField
              control={form.control}
              name="participants"
              label="People"
              inputMode="numeric"
            />
          </div>
          <TextAreaField
            control={form.control}
            name="specialRequests"
            label="Notes (optional)"
            rows={3}
          />
        </FieldGroup>
      </Section>

      {hasEmail ? (
        <Checkbox control={form.control} name="emailClient">
          Email the client the updated booking
        </Checkbox>
      ) : (
        <p className="text-sm text-muted-foreground">
          This client has no email. Share the updated booking card from the booking page instead.
        </p>
      )}

      {outsideWarning && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-terracotta bg-blush p-4 text-terracotta-ink sm:flex-row sm:items-center"
        >
          <AlertTriangleIcon className="size-5 shrink-0" aria-hidden />
          <p className="flex-1 font-semibold">{outsideWarning} Save it anyway?</p>
          <Button
            type="button"
            variant="outline"
            disabled={form.formState.isSubmitting}
            onClick={form.handleSubmit(() => save(true))}
          >
            Save anyway
          </Button>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t pt-6">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          Save changes
        </Button>
      </div>
    </form>
  );
}

function Checkbox({
  control,
  name,
  children,
}: {
  control: Control<AdminBookingEditInput, unknown, EditOutput>;
  name: "chargeVat" | "emailClient";
  children: React.ReactNode;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border bg-card p-4">
          <input
            type="checkbox"
            checked={Boolean(field.value)}
            onChange={(e) => field.onChange(e.target.checked)}
            ref={field.ref}
            className="size-5 shrink-0 accent-primary"
          />
          <span className="text-sm font-semibold">{children}</span>
        </label>
      )}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
