"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangleIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { SelectField, TextAreaField, TextField } from "@/components/admin/form-fields";
import {
  AddOnsEditor,
  timeAddOnIds,
  type AddOnChoice,
} from "@/components/admin/bookings/add-ons-editor";
import { BookingTotals } from "@/components/admin/bookings/booking-totals";
import { ScheduleField } from "@/components/admin/bookings/schedule-field";
import { handleResult } from "@/components/admin/form-utils";
import { useUnsavedChangesWarning } from "@/components/admin/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { centsToPesoInput } from "@/lib/utils/money";
import { adminBookingSchema, type AdminBookingInput } from "@/lib/validations/admin-booking";
import { CONTACT_METHODS } from "@/lib/validations/booking";
import { createAdminBooking } from "@/server/actions/admin-bookings";

export type PackageChoice = { id: string; name: string; priceCents: number; active: boolean };

const DEPOSITS = [
  { value: "gcash", label: "Paid by GCash" },
  { value: "cash", label: "Paid in cash" },
  { value: "none", label: "Pay at the shoot" },
] as const;

/** Staff book a client in (confirmed straight away). */
export function AdminBookingForm({
  packages,
  addOnCatalog,
  initialDate,
  initialTime,
}: {
  packages: PackageChoice[];
  addOnCatalog: AddOnChoice[];
  initialDate: string | null;
  initialTime: string | null;
}) {
  const router = useRouter();
  const [outsideWarning, setOutsideWarning] = useState<string | null>(null);

  const form = useForm<AdminBookingInput, unknown, z.output<typeof adminBookingSchema>>({
    resolver: zodResolver(adminBookingSchema),
    defaultValues: {
      serviceId: packages[0]?.id ?? "",
      date: initialDate ?? "",
      time: initialTime ?? "",
      price: packages[0] ? centsToPesoInput(packages[0].priceCents) : "",
      fullName: "",
      email: "",
      phone: "",
      preferredContact: "phone",
      messenger: "",
      location: "",
      participants: "1",
      specialRequests: "",
      deposit: "none",
      depositAmount: "",
      gcashReference: "",
      consent: false as unknown as true,
      allowOutsideHours: false,
      addOns: [],
    },
  });
  useUnsavedChangesWarning(form.formState.isDirty);
  const [serviceId, deposit, price, addOns] = useWatch({
    control: form.control,
    name: ["serviceId", "deposit", "price", "addOns"],
  });

  // A newly chosen package starts from its listed price (staff can still change it).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const pkg = packages.find((p) => p.id === serviceId);
    if (pkg) form.setValue("price", centsToPesoInput(pkg.priceCents));
  }, [serviceId, packages, form]);

  async function save(allowOutsideHours: boolean) {
    form.setValue("allowOutsideHours", allowOutsideHours);
    const result = await createAdminBooking(form.getValues());
    if (!result.ok && result.fieldErrors?.allowOutsideHours) {
      setOutsideWarning(result.error);
      return;
    }
    setOutsideWarning(null);
    if (handleResult(result, "Booking created.", form)) {
      router.push(`/admin/bookings/${result.data.id}`);
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
            description="Changing the package resets the price."
          />
          <TextField
            control={form.control}
            name="price"
            label="Price"
            prefix="₱"
            inputMode="decimal"
          />
        </div>
      </Section>

      <Section title="Add-ons">
        <AddOnsEditor control={form.control} catalog={addOnCatalog} serviceId={serviceId} />
        <BookingTotals packagePrice={price} addOns={addOns} vatPercent={0} chargeVat={false} />
        <p className="text-xs text-muted-foreground">
          VAT can be added on the booking page after it&apos;s created.
        </p>
      </Section>

      <Section title="Date & time">
        <ScheduleField
          form={form}
          addOnIds={timeAddOnIds(addOns, addOnCatalog)}
          initialDate={initialDate}
          startInAnyTime={Boolean(initialTime)}
        />
      </Section>

      <Section title="Client">
        <FieldGroup>
          <TextField control={form.control} name="fullName" label="Name" autoComplete="off" />
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField control={form.control} name="phone" label="Mobile number" type="tel" />
            <TextField
              control={form.control}
              name="email"
              label="Email (optional)"
              type="email"
              description="Without an email the client gets no confirmation; share the booking card instead."
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="preferredContact"
              label="Best way to reach them"
              options={[...CONTACT_METHODS]}
            />
            <TextField
              control={form.control}
              name="messenger"
              label="Facebook name or Messenger link"
              placeholder="https://m.me/…"
            />
          </div>
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

      <Section title="Deposit">
        <Controller
          control={form.control}
          name="deposit"
          render={({ field }) => (
            <div role="radiogroup" aria-label="Deposit" className="grid gap-2 sm:grid-cols-3">
              {DEPOSITS.map((d) => (
                <label
                  key={d.value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border bg-card px-4 py-3 font-semibold",
                    "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    field.value === d.value && "border-primary bg-accent/60",
                  )}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={d.value}
                    checked={field.value === d.value}
                    onChange={() => field.onChange(d.value)}
                    className="size-4 accent-primary"
                  />
                  {d.label}
                </label>
              ))}
            </div>
          )}
        />
        {deposit !== "none" && (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="depositAmount"
              label="Amount received"
              prefix="₱"
              inputMode="decimal"
            />
            {deposit === "gcash" && (
              <TextField
                control={form.control}
                name="gcashReference"
                label="GCash reference no. (optional)"
              />
            )}
          </div>
        )}
      </Section>

      <Controller
        control={form.control}
        name="consent"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4">
              <input
                type="checkbox"
                checked={Boolean(field.value)}
                onChange={(e) => field.onChange(e.target.checked)}
                ref={field.ref}
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
              <span className="text-sm">
                The client agreed to us keeping these details to arrange and contact them about this
                booking (Data Privacy Act of 2012).
              </span>
            </label>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {outsideWarning && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-terracotta bg-blush p-4 text-terracotta-ink sm:flex-row sm:items-center"
        >
          <AlertTriangleIcon className="size-5 shrink-0" aria-hidden />
          <p className="flex-1 font-semibold">{outsideWarning} Book it anyway?</p>
          <Button
            type="button"
            variant="outline"
            disabled={form.formState.isSubmitting}
            onClick={form.handleSubmit(() => save(true))}
          >
            Book anyway
          </Button>
        </div>
      )}

      <div className="flex justify-end border-t pt-6">
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          Create booking
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
