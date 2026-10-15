"use client";

import { TZDate } from "@date-fns/tz";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format } from "date-fns";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ClockIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { SelectField, TextAreaField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { SlotPicker } from "@/components/booking/slot-picker";
import { Turnstile } from "@/components/booking/turnstile";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { formatBookingWhen } from "@/lib/booking/booking-summary";
import { categoryLabel } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatDuration } from "@/lib/utils/format";
import { formatPeso } from "@/lib/utils/money";
import {
  CONTACT_METHODS,
  publicBookingSchema,
  type PublicBookingInput,
} from "@/lib/validations/booking";
import { getMonthSlots } from "@/server/actions/availability-slots";
import { submitBooking } from "@/server/actions/booking";
import type { PublicService } from "@/server/queries/public";

type Values = PublicBookingInput;
type Output = z.output<typeof publicBookingSchema>;

const STEPS: { title: string; fields: FieldPath<Values>[] }[] = [
  {
    title: "Your details",
    fields: ["fullName", "email", "phone", "preferredContact", "messenger", "consent"],
  },
  { title: "Package", fields: ["serviceId"] },
  { title: "Date & time", fields: ["startAt"] },
  { title: "Shoot details", fields: ["location", "participants", "specialRequests"] },
  { title: "Review & pay", fields: [] },
];

export type WizardService = Pick<
  PublicService,
  | "id"
  | "slug"
  | "name"
  | "category"
  | "summary"
  | "price_cents"
  | "deposit_cents"
  | "duration_minutes"
>;

export function BookingWizard({
  services,
  initialServiceId,
  businessName,
  depositPercent,
  holdMinutes,
  maxAdvanceDays,
}: {
  services: WizardService[];
  initialServiceId: string | null;
  businessName: string;
  depositPercent: number;
  holdMinutes: number;
  maxAdvanceDays: number;
}) {
  const [step, setStep] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [submitting, startSubmit] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);

  const form = useForm<Values, unknown, Output>({
    resolver: zodResolver(publicBookingSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      preferredContact: "email",
      messenger: "",
      consent: false as unknown as true,
      serviceId: initialServiceId ?? "",
      startAt: "",
      location: "",
      participants: "1",
      specialRequests: "",
      turnstileToken: "",
      website: "",
    },
  });
  const [serviceId, startAt, preferredContact] = useWatch({
    control: form.control,
    name: ["serviceId", "startAt", "preferredContact"],
  });
  const service = services.find((s) => s.id === serviceId);
  const deposit = service
    ? (service.deposit_cents ?? Math.round((service.price_cents * depositPercent) / 100))
    : 0;

  const now = TZDate.tz(BUSINESS_TZ);
  const minMonth = format(now, "yyyy-MM");
  const maxMonth = format(addDays(now, maxAdvanceDays), "yyyy-MM");
  const loadMonth = useCallback(
    (month: string) => getMonthSlots({ serviceId, month }),
    [serviceId],
  );
  const onToken = useCallback((token: string) => form.setValue("turnstileToken", token), [form]);

  const goTo = setStep;
  // Move focus to the new step's heading so screen readers announce it (not on first load).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  async function next() {
    if (await form.trigger(STEPS[step]!.fields)) goTo(step + 1);
  }

  /** The step that shows the first of these fields (to reveal an error). */
  function stepWith(fields: string[]) {
    const i = STEPS.findIndex((s) => s.fields.some((f) => fields.includes(f)));
    return i === -1 ? step : i;
  }

  function onSubmit() {
    startSubmit(async () => {
      // Send the raw form strings: the server re-validates with the same schema.
      const result = await submitBooking(form.getValues());
      if (result.ok) {
        window.location.assign(result.data.redirectUrl);
        return;
      }
      if (result.fieldErrors?.startAt) {
        // Someone else just took that time: back to the calendar with fresh slots.
        form.setValue("startAt", "");
        setReloadKey((k) => k + 1);
        goTo(2);
        toast.error(result.error);
        return;
      }
      if (result.fieldErrors) goTo(stepWith(Object.keys(result.fieldErrors)));
      handleResult(result, "", form);
    });
  }

  const last = step === STEPS.length - 1;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, (errors) => goTo(stepWith(Object.keys(errors))))}
      noValidate
      className="space-y-8"
    >
      <ol className="flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className={cn(
              "h-1.5 flex-1 rounded-full bg-muted transition-colors",
              i <= step && "bg-primary",
            )}
          />
        ))}
      </ol>
      <div>
        <p className="text-sm font-semibold text-terracotta-ink">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 ref={heading} tabIndex={-1} className="text-3xl font-semibold outline-none">
          {STEPS[step]!.title}
        </h2>
      </div>

      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" {...form.register("website")} />
        </label>
      </div>

      {step === 0 && (
        <FieldGroup>
          <TextField control={form.control} name="fullName" label="Full name" autoComplete="name" />
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
            />
            <TextField
              control={form.control}
              name="phone"
              label="Mobile number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <SelectField
            control={form.control}
            name="preferredContact"
            label="Best way to reach you"
            options={[...CONTACT_METHODS]}
          />
          <TextField
            control={form.control}
            name="messenger"
            label={
              preferredContact === "messenger"
                ? "Facebook name or Messenger link"
                : "Facebook name or Messenger link (optional)"
            }
            placeholder="e.g. https://m.me/your.name"
          />
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
                    onBlur={field.onBlur}
                    ref={field.ref}
                    aria-invalid={fieldState.invalid}
                    className="mt-0.5 size-5 shrink-0 accent-primary"
                  />
                  <span className="text-sm">
                    I agree to {businessName} using these details to arrange my booking and contact
                    me about it, under the Philippine Data Privacy Act of 2012.
                  </span>
                </label>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
      )}

      {step === 1 && (
        <Controller
          control={form.control}
          name="serviceId"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div role="radiogroup" aria-label="Packages" className="grid gap-3 sm:grid-cols-2">
                {services.map((s) => {
                  const checked = field.value === s.id;
                  return (
                    <label
                      key={s.id}
                      className={cn(
                        "flex cursor-pointer flex-col gap-1 rounded-2xl border bg-card p-4 transition-colors hover:border-primary",
                        "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                        checked && "border-primary bg-accent/50 ring-1 ring-primary",
                      )}
                    >
                      <input
                        type="radio"
                        name={field.name}
                        value={s.id}
                        checked={checked}
                        onChange={() => {
                          field.onChange(s.id);
                          form.setValue("startAt", "");
                        }}
                        className="sr-only"
                      />
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-heading text-lg font-semibold">{s.name}</span>
                        {checked && (
                          <CheckIcon className="size-5 shrink-0 text-primary" aria-hidden />
                        )}
                      </span>
                      <span className="text-xs font-semibold text-terracotta-ink">
                        {categoryLabel(s.category)}
                      </span>
                      <span className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="font-bold text-foreground">
                          {formatPeso(s.price_cents)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="size-3.5" aria-hidden />
                          {formatDuration(s.duration_minutes)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      )}

      {step === 2 && service && (
        <Controller
          control={form.control}
          name="startAt"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <p className="text-muted-foreground">
                {service.name} · {formatDuration(service.duration_minutes)}
              </p>
              <SlotPicker
                key={service.id}
                load={loadMonth}
                minMonth={minMonth}
                maxMonth={maxMonth}
                value={field.value || null}
                onChange={(iso) => field.onChange(iso ?? "")}
                reloadKey={reloadKey}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      )}

      {step === 3 && (
        <FieldGroup>
          <TextField
            control={form.control}
            name="location"
            label="Location (optional)"
            placeholder="Our studio, a venue, or an address"
            maxLength={300}
          />
          <TextField
            control={form.control}
            name="participants"
            label="Number of people"
            inputMode="numeric"
            className="max-w-40"
          />
          <TextAreaField
            control={form.control}
            name="specialRequests"
            label="Anything we should know? (optional)"
            rows={4}
            maxLength={2000}
          />
        </FieldGroup>
      )}

      {last && service && startAt && (
        <div className="space-y-6">
          <dl className="divide-y rounded-3xl border bg-card">
            <ReviewRow label="Package" value={service.name} onEdit={() => goTo(1)} />
            <ReviewRow
              label="When"
              value={formatBookingWhen(
                startAt,
                new Date(
                  new Date(startAt).getTime() + service.duration_minutes * 60_000,
                ).toISOString(),
              )}
              onEdit={() => goTo(2)}
            />
            <ReviewRow
              label="Contact"
              value={`${form.getValues("fullName")} · ${form.getValues("email")} · ${form.getValues("phone")}`}
              onEdit={() => goTo(0)}
            />
            {form.getValues("location") && (
              <ReviewRow
                label="Location"
                value={form.getValues("location")!}
                onEdit={() => goTo(3)}
              />
            )}
          </dl>
          <div className="rounded-3xl bg-accent p-5 text-accent-foreground">
            <div className="flex justify-between gap-4">
              <span>Package price</span>
              <span className="font-bold">{formatPeso(service.price_cents)}</span>
            </div>
            {deposit > 0 && (
              <>
                <div className="mt-2 flex justify-between gap-4">
                  <span>Deposit to pay now</span>
                  <span className="font-heading text-2xl font-semibold">{formatPeso(deposit)}</span>
                </div>
                <p className="mt-3 text-sm">
                  We hold this time for {holdMinutes} minutes while you pay securely with PayMongo
                  (GCash, card and more).
                </p>
              </>
            )}
          </div>
          <Turnstile onToken={onToken} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => goTo(step - 1)}
            disabled={submitting}
          >
            <ArrowLeftIcon aria-hidden />
            Back
          </Button>
        ) : (
          <span />
        )}
        {last ? (
          // Distinct keys: React must not turn the clicked "Continue" button into this
          // submit button mid-click, or the form submits and skips the Review step.
          <Button key="submit" type="submit" size="lg" disabled={submitting}>
            {submitting && <Loader2Icon className="animate-spin" aria-hidden />}
            {deposit > 0 ? `Pay ${formatPeso(deposit)} deposit` : "Request booking"}
          </Button>
        ) : (
          <Button key="continue" type="button" size="lg" onClick={next}>
            Continue
            <ArrowRightIcon aria-hidden />
          </Button>
        )}
      </div>
    </form>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div className="min-w-0">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="font-semibold break-words">{value}</dd>
      </div>
      <Button type="button" variant="link" className="shrink-0 px-0" onClick={onEdit}>
        Edit<span className="sr-only"> {label.toLowerCase()}</span>
      </Button>
    </div>
  );
}
