"use client";

import { TZDate } from "@date-fns/tz";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format } from "date-fns";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ClockIcon, Loader2Icon } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldPath, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { SelectField, TextAreaField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { rememberBooking } from "@/components/booking/add-to-calendar";
import { clearDraft, loadDraft, saveDraft } from "@/components/booking/booking-draft";
import { BookingSummaryPanel } from "@/components/booking/booking-summary-panel";
import { SlotPicker } from "@/components/booking/slot-picker";
import { Turnstile } from "@/components/booking/turnstile";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { formatBookingWhen } from "@/lib/booking/booking-summary";
import { addOnOffered, sessionEndAt } from "@/lib/booking/package-length";
import { bookingTotals } from "@/lib/booking/pricing";
import { WORKSHOP_REFUND_RULE } from "@/lib/booking/workshop";
import { categoryLabel } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { formatDuration } from "@/lib/utils/format";
import { formatPeso } from "@/lib/utils/money";
import {
  CONTACT_METHODS,
  publicBookingSchema,
  WORKSHOP_MAX_PEOPLE,
  type PublicBookingInput,
} from "@/lib/validations/booking";
import { getMonthSlots } from "@/server/actions/availability-slots";
import { submitBooking } from "@/server/actions/booking";
import type { PublicAddOn, PublicService } from "@/server/queries/public";

type Values = PublicBookingInput;
type Output = z.output<typeof publicBookingSchema>;

type Step = {
  id: "details" | "package" | "when" | "extras" | "attendees" | "review";
  title: string;
  fields: FieldPath<Values>[];
};
const PACKAGE_STEPS: Step[] = [
  {
    id: "details",
    title: "Your details",
    fields: ["fullName", "email", "phone", "preferredContact", "messenger", "consent"],
  },
  { id: "package", title: "Package", fields: ["serviceId", "addOnIds"] },
  { id: "when", title: "Date & time", fields: ["startAt"] },
  {
    id: "extras",
    title: "Shoot details",
    fields: ["location", "participants", "specialRequests"],
  },
  { id: "review", title: "Review & pay", fields: [] },
];
/**
 * Workshops are priced per person at a time and place the admin sets: no date
 * step; who's coming (1 to 3 people) comes first, then each person's name for
 * their certificate (only when 2+ are coming), so the Payment step's half/full
 * amounts already cover everyone.
 */
const WORKSHOP_STEPS: Step[] = [
  PACKAGE_STEPS[0]!,
  { id: "extras", title: "Who's coming", fields: ["participants", "specialRequests"] },
  { id: "attendees", title: "Certificates", fields: ["attendees"] },
  { id: "package", title: "Payment", fields: ["payInFull", "refundRuleAccepted"] },
  PACKAGE_STEPS[4]!,
];

/** People on a workshop sign-up as typed (the price is per person); at least 1. */
function peopleCount(participants: string | undefined): number {
  const n = Number((participants ?? "").replace(/,/g, ""));
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

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
  addOns,
  initialServiceId,
  businessName,
  depositPercent,
  vatPercent,
  holdMinutes,
  maxAdvanceDays,
  workshop = null,
}: {
  services: WizardService[];
  addOns: PublicAddOn[];
  initialServiceId: string | null;
  businessName: string;
  depositPercent: number;
  vatPercent: number;
  holdMinutes: number;
  maxAdvanceDays: number;
  /**
   * Workshop flow: one fixed-price workshop (services[0]) at the time the admin
   * set, paid half or in full.
   */
  workshop?: {
    startAt: string;
    endAt: string;
    location: string | null;
    /** Seats still free, or null for no limit. */
    seatsLeft: number | null;
  } | null;
}) {
  const [step, setStep] = useState(0);
  // +1 moving forward, -1 going back: steps slide in from that side.
  const [direction, setDirection] = useState<1 | -1>(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [submitting, startSubmit] = useTransition();
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);

  const emptyValues = (): Values => ({
    fullName: "",
    email: "",
    phone: "",
    preferredContact: "email",
    messenger: "",
    consent: false as unknown as true,
    serviceId: initialServiceId ?? "",
    addOnIds: [],
    startAt: workshop?.startAt ?? "",
    location: "",
    participants: "1",
    specialRequests: "",
    turnstileToken: "",
    website: "",
    ...(workshop && { payInFull: false, refundRuleAccepted: false }),
  });
  const form = useForm<Values, unknown, Output>({
    resolver: zodResolver(publicBookingSchema),
    defaultValues: emptyValues(),
  });

  // Bring back what they typed last time (this browser only), then keep it saved as they go.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
    form.reset({
      ...form.getValues(),
      ...draft,
      // A package picked with "Book now" wins over the one saved last time.
      serviceId:
        initialServiceId ??
        (services.some((s) => s.id === draft.serviceId) ? (draft.serviceId ?? "") : ""),
      addOnIds: (draft.addOnIds ?? []).filter((id) =>
        addOns.some((a) => a.id === id && addOnOffered(a, draft.serviceId ?? "")),
      ),
      // A workshop's time is set by the studio, never by an old draft.
      ...(workshop && { startAt: workshop.startAt }),
    });
    // Browser storage can only be read after hydration, so this can't be initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestored(true);
    // Once, on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const allValues = useWatch({ control: form.control });
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft(allValues as Partial<Values>);
    }, 400);
    return () => clearTimeout(timer);
  }, [allValues]);

  function startOver() {
    clearDraft();
    form.reset(emptyValues());
    setRestored(false);
    goTo(0);
  }
  const [serviceId, startAt, preferredContact, addOnIds, location, payInFull, participants] =
    useWatch({
      control: form.control,
      name: [
        "serviceId",
        "startAt",
        "preferredContact",
        "addOnIds",
        "location",
        "payInFull",
        "participants",
      ],
    });
  // Workshops are priced per person; packages per booking.
  const people = workshop ? peopleCount(participants) : 1;
  // Workshops ask for certificate names only when 2 or more people are coming.
  const STEPS = workshop
    ? WORKSHOP_STEPS.filter((s) => s.id !== "attendees" || people > 1)
    : PACKAGE_STEPS;
  /** Index of a step by id (-1 when this flow doesn't have it). */
  const at = (id: Step["id"]) => STEPS.findIndex((s) => s.id === id);
  const service = services.find((s) => s.id === serviceId);
  // Each add-on lists the packages it goes with (e.g. extensions only for the Photobooth).
  const offeredAddOns = service ? addOns.filter((a) => addOnOffered(a, service.id)) : [];
  const chosenAddOns = offeredAddOns.filter((a) => addOnIds.includes(a.id));
  // Only packages with a set length have an end time; add-ons can lengthen them.
  const extraMinutes =
    service?.duration_minutes != null
      ? chosenAddOns.reduce((sum, a) => sum + a.extra_minutes, 0)
      : 0;
  const timeAddOnIds = chosenAddOns.filter((a) => a.extra_minutes > 0).map((a) => a.id);
  const timeKey = timeAddOnIds.join(",");
  // Mirrors create_booking, which recomputes both on the server.
  const { subtotal, vat, total, deposit } = service
    ? bookingTotals({
        packageCents: service.price_cents * people,
        addOnsCents: chosenAddOns.reduce((sum, a) => sum + a.price_cents, 0),
        vatPercent,
        fixedDepositCents: service.deposit_cents,
        depositPercent,
        payInFull,
      })
    : { subtotal: 0, vat: 0, total: 0, deposit: 0 };
  const endAt = workshop
    ? workshop.endAt
    : service && startAt
      ? sessionEndAt(startAt, service.duration_minutes, extraMinutes)
      : null;

  const now = TZDate.tz(BUSINESS_TZ);
  const minMonth = format(now, "yyyy-MM");
  const maxMonth = format(addDays(now, maxAdvanceDays), "yyyy-MM");
  // The picker is keyed by package + time add-ons, so it never mixes slots from another length.
  const loadMonth = (month: string) => getMonthSlots({ serviceId, month, addOnIds: timeAddOnIds });
  const onToken = useCallback((token: string) => form.setValue("turnstileToken", token), [form]);

  // Each step forward gets its own browser-history entry, so the browser's Back
  // button (or a phone's back swipe) steps back through the wizard instead of
  // leaving the page. Moving back in the page goes through history too, keeping
  // history and step in line; popstate then shows the step.
  function goTo(to: number) {
    if (to === step) return;
    if (to < step) {
      window.history.go(to - step);
      return;
    }
    for (let s = step + 1; s <= to; s++) {
      window.history.pushState({ ...window.history.state, wizardStep: s }, "");
    }
    setDirection(1);
    setStep(to);
  }
  // After a reload the wizard restarts at step 1: make this history entry match.
  useEffect(() => {
    if (window.history.state?.wizardStep) {
      window.history.replaceState({ ...window.history.state, wizardStep: 0 }, "");
    }
  }, []);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const to = (e.state as { wizardStep?: number } | null)?.wizardStep ?? 0;
      setDirection(to < step ? -1 : 1);
      setStep(to);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [step]);
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
    if (!(await form.trigger(STEPS[step]!.fields))) return;
    // Say so now rather than at payment if there aren't enough seats left.
    const seatsLeft = workshop?.seatsLeft ?? null;
    if (stepId === "extras" && seatsLeft !== null && people > seatsLeft) {
      form.setError("participants", {
        message: `Only ${seatsLeft} ${seatsLeft === 1 ? "seat is" : "seats are"} left.`,
      });
      return;
    }
    if (workshop && stepId === "extras") {
      // One name box per person; the first starts as the booker's name.
      const names = form.getValues("attendees") ?? [];
      form.setValue(
        "attendees",
        people > 1
          ? Array.from(
              { length: people },
              (_, i) => names[i] ?? (i === 0 ? form.getValues("fullName").trim() : ""),
            )
          : [],
      );
    }
    goTo(step + 1);
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
        clearDraft();
        if (service) {
          rememberBooking({
            reference: result.data.reference,
            title: `${service.name} · ${businessName}`,
            startAt,
            endAt,
            location: (workshop ? workshop.location : location) || null,
          });
        }
        window.location.assign(result.data.redirectUrl);
        return;
      }
      if (result.fieldErrors?.addOnIds) router.refresh(); // fetch the add-ons still offered
      if (result.fieldErrors?.startAt) {
        // Someone else just took that time: back to the calendar with fresh slots.
        form.setValue("startAt", "");
        setReloadKey((k) => k + 1);
        if (at("when") !== -1) goTo(at("when"));
        toast.error(result.error);
        return;
      }
      if (result.fieldErrors) goTo(stepWith(Object.keys(result.fieldErrors)));
      handleResult(result, "", form);
    });
  }

  const last = step === STEPS.length - 1;
  const stepId = STEPS[step]!.id;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, (errors) => goTo(stepWith(Object.keys(errors))))}
      noValidate
      className="space-y-8 sm:space-y-12"
    >
      <StepTracker steps={STEPS} step={step} onGoTo={goTo} disabled={submitting} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
        <div className="min-w-0 space-y-8">
          <div>
            <p className="text-sm font-semibold text-terracotta-ink">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 ref={heading} tabIndex={-1} className="text-3xl font-semibold outline-none">
              {STEPS[step]!.title}
            </h2>
          </div>

          {restored && step === 0 && (
            <div
              role="status"
              className="flex animate-in flex-wrap items-center justify-between gap-3 rounded-2xl border border-sage bg-secondary px-4 py-3 text-sm text-secondary-foreground duration-300 fade-in"
            >
              <span>
                <strong>Welcome back!</strong> We kept the details you entered last time.
              </span>
              <Button type="button" variant="link" className="h-auto px-0" onClick={startOver}>
                Start over
              </Button>
            </div>
          )}

          {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>
              Website
              <input type="text" tabIndex={-1} autoComplete="off" {...form.register("website")} />
            </label>
          </div>

          <MotionConfig reducedMotion="user">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={SLIDE}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {step === 0 && (
                  <FieldGroup>
                    <TextField
                      control={form.control}
                      name="fullName"
                      label="Full name"
                      autoComplete="name"
                    />
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
                              I agree to {businessName} using these details to arrange my booking
                              and contact me about it, under the Philippine Data Privacy Act of
                              2012.
                            </span>
                          </label>
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />
                  </FieldGroup>
                )}

                {stepId === "package" && workshop && service && (
                  <WorkshopPayment
                    form={form}
                    service={service}
                    people={people}
                    vatPercent={vatPercent}
                    depositPercent={depositPercent}
                  />
                )}

                {stepId === "package" && !workshop && (
                  <Controller
                    control={form.control}
                    name="serviceId"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <div
                          role="radiogroup"
                          aria-label="Packages"
                          className="grid gap-3 sm:grid-cols-2"
                        >
                          {services.map((s) => {
                            const checked = field.value === s.id;
                            return (
                              <label
                                key={s.id}
                                className={cn(
                                  "flex cursor-pointer flex-col gap-1 rounded-2xl border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md",
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
                                    // Drop add-ons the new package doesn't offer.
                                    form.setValue(
                                      "addOnIds",
                                      addOnIds.filter((id) =>
                                        addOns.some((a) => a.id === id && addOnOffered(a, s.id)),
                                      ),
                                    );
                                  }}
                                  className="sr-only"
                                />
                                <span className="flex items-start justify-between gap-2">
                                  <span className="font-heading text-lg font-semibold">
                                    {s.name}
                                  </span>
                                  {checked && (
                                    <span className="grid size-6 shrink-0 animate-in place-items-center rounded-full bg-primary text-primary-foreground duration-300 zoom-in-50">
                                      <CheckIcon className="size-4" aria-hidden />
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs font-semibold text-terracotta-ink">
                                  {categoryLabel(s.category)}
                                </span>
                                <span className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                                  <span className="font-bold text-foreground">
                                    {formatPeso(s.price_cents)}
                                  </span>
                                  {s.duration_minutes !== null && (
                                    <span className="flex items-center gap-1">
                                      <ClockIcon className="size-3.5" aria-hidden />
                                      {formatDuration(s.duration_minutes)}
                                    </span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {vatPercent > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Prices are before {vatPercent}% VAT, which is added at checkout.
                          </p>
                        )}
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                )}

                {stepId === "package" && offeredAddOns.length > 0 && (
                  <Controller
                    control={form.control}
                    name="addOnIds"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid} className="mt-8">
                        <fieldset className="space-y-3">
                          <legend className="font-heading text-xl font-semibold">
                            Add-ons{" "}
                            <span className="text-base text-muted-foreground">(optional)</span>
                          </legend>
                          <p className="text-sm text-muted-foreground">
                            Extras for your shoot. They&apos;re added to your total.
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {offeredAddOns.map((a) => {
                              const checked = field.value.includes(a.id);
                              return (
                                <label
                                  key={a.id}
                                  className={cn(
                                    "flex cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4 transition-all duration-200 hover:border-primary hover:shadow-md",
                                    "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                                    checked && "border-primary bg-accent/50 ring-1 ring-primary",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      field.onChange(
                                        e.target.checked
                                          ? [...field.value, a.id]
                                          : field.value.filter((id) => id !== a.id),
                                      );
                                      // More (or less) time changes which start times fit.
                                      if (a.extra_minutes > 0) form.setValue("startAt", "");
                                    }}
                                    className="mt-0.5 size-5 shrink-0 accent-primary"
                                  />
                                  <span className="min-w-0">
                                    <span className="flex flex-wrap items-baseline gap-x-2">
                                      <span className="font-semibold">{a.name}</span>
                                      <span className="text-sm font-bold text-terracotta-ink">
                                        {a.price_cents > 0
                                          ? `+ ${formatPeso(a.price_cents)}`
                                          : "Free"}
                                      </span>
                                    </span>
                                    {a.description && (
                                      <span className="mt-0.5 block text-sm text-muted-foreground">
                                        {a.description}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                )}

                {stepId === "when" && service && (
                  <Controller
                    control={form.control}
                    name="startAt"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <p className="text-muted-foreground">
                          {service.name}
                          {service.duration_minutes !== null &&
                            ` · ${formatDuration(service.duration_minutes + extraMinutes)}`}
                        </p>
                        <SlotPicker
                          key={`${service.id}:${timeKey}`}
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

                {stepId === "extras" && (
                  <FieldGroup>
                    {/* A workshop's place is set by the studio. */}
                    {!workshop && (
                      <TextField
                        control={form.control}
                        name="location"
                        label="Location (optional)"
                        placeholder="Our studio, a venue, or an address"
                        maxLength={300}
                      />
                    )}
                    {workshop && service ? (
                      <PeoplePicker
                        form={form}
                        priceCents={service.price_cents}
                        seatsLeft={workshop.seatsLeft}
                      />
                    ) : (
                      <TextField
                        control={form.control}
                        name="participants"
                        label="Number of people"
                        inputMode="numeric"
                        className="max-w-40"
                      />
                    )}
                    {workshop && service && (
                      <p className="font-semibold">
                        Workshop price for {people} {people === 1 ? "person" : "people"}:{" "}
                        {formatPeso(service.price_cents * people)}
                        {vatPercent > 0 && (
                          <span className="font-normal text-muted-foreground"> + VAT</span>
                        )}
                      </p>
                    )}
                    <TextAreaField
                      control={form.control}
                      name="specialRequests"
                      label="Anything we should know? (optional)"
                      rows={4}
                      maxLength={2000}
                    />
                  </FieldGroup>
                )}

                {stepId === "attendees" && (
                  <FieldGroup>
                    <p className="text-muted-foreground">
                      Everyone who joins gets a certificate. Write each name exactly as it should be
                      printed.
                    </p>
                    {Array.from({ length: people }, (_, i) => (
                      <TextField
                        key={i}
                        control={form.control}
                        name={`attendees.${i}`}
                        label={`Person ${i + 1}: full name`}
                        description={
                          i === 0 ? "That's you, unless you're signing up someone else." : undefined
                        }
                        autoComplete={i === 0 ? "name" : "off"}
                        maxLength={120}
                      />
                    ))}
                  </FieldGroup>
                )}

                {last && service && startAt && (
                  <div className="space-y-6">
                    <dl className="divide-y rounded-3xl border bg-card">
                      {workshop ? (
                        <ReviewRow
                          label="Workshop"
                          value={`${service.name} · ${people} ${people === 1 ? "person" : "people"} · ${payInFull ? "paying in full" : "paying half now"}`}
                          onEdit={() => goTo(at("package"))}
                        />
                      ) : (
                        <ReviewRow
                          label="Package"
                          value={service.name}
                          onEdit={() => goTo(at("package"))}
                        />
                      )}
                      {workshop && (
                        <ReviewRow
                          label={people > 1 ? "Names for certificates" : "Name for the certificate"}
                          value={(people > 1
                            ? (form.getValues("attendees") ?? []).slice(0, people)
                            : [form.getValues("fullName")]
                          ).join(", ")}
                          onEdit={() => goTo(at(people > 1 ? "attendees" : "details"))}
                        />
                      )}
                      {chosenAddOns.length > 0 && (
                        <ReviewRow
                          label="Add-ons"
                          value={chosenAddOns.map((a) => a.name).join(", ")}
                          onEdit={() => goTo(at("package"))}
                        />
                      )}
                      <ReviewRow
                        label="When"
                        value={formatBookingWhen(startAt, endAt)}
                        onEdit={workshop ? undefined : () => goTo(at("when"))}
                      />
                      <ReviewRow
                        label="Contact"
                        value={`${form.getValues("fullName")} · ${form.getValues("email")} · ${form.getValues("phone")}`}
                        onEdit={() => goTo(0)}
                      />
                      {workshop?.location && (
                        <ReviewRow label="Location" value={workshop.location} />
                      )}
                      {!workshop && form.getValues("location") && (
                        <ReviewRow
                          label="Location"
                          value={form.getValues("location")!}
                          onEdit={() => goTo(at("extras"))}
                        />
                      )}
                    </dl>
                    <div className="rounded-3xl bg-accent p-5 text-accent-foreground">
                      <div className="flex justify-between gap-4">
                        <span>
                          {workshop
                            ? `Workshop price (${formatPeso(service.price_cents)} × ${people})`
                            : "Package price"}
                        </span>
                        <span className="font-bold">
                          {formatPeso(service.price_cents * people)}
                        </span>
                      </div>
                      {chosenAddOns.map((a) => (
                        <div key={a.id} className="mt-1 flex justify-between gap-4">
                          <span>{a.name}</span>
                          <span className="font-bold">+ {formatPeso(a.price_cents)}</span>
                        </div>
                      ))}
                      {vat > 0 && chosenAddOns.length > 0 && (
                        <div className="mt-2 flex justify-between gap-4 border-t border-accent-foreground/20 pt-2">
                          <span>Subtotal</span>
                          <span className="font-bold">{formatPeso(subtotal)}</span>
                        </div>
                      )}
                      {vat > 0 && (
                        <div className="mt-1 flex justify-between gap-4">
                          <span>VAT ({vatPercent}%)</span>
                          <span className="font-bold">+ {formatPeso(vat)}</span>
                        </div>
                      )}
                      {(vat > 0 || chosenAddOns.length > 0) && (
                        <div className="mt-2 flex justify-between gap-4 border-t border-accent-foreground/20 pt-2">
                          <span className="font-semibold">Total</span>
                          <span className="font-bold">{formatPeso(total)}</span>
                        </div>
                      )}
                      {deposit > 0 && (
                        <>
                          <div className="mt-2 flex justify-between gap-4">
                            <span>{deposit >= total ? "To pay now" : "Deposit to pay now"}</span>
                            <span className="font-heading text-2xl font-semibold">
                              {formatPeso(deposit)}
                            </span>
                          </div>
                          {total > deposit && (
                            <div className="mt-1 flex justify-between gap-4 text-sm">
                              <span>Balance, paid later</span>
                              <span>{formatPeso(total - deposit)}</span>
                            </div>
                          )}
                          {workshop && <p className="mt-3 text-sm">{WORKSHOP_REFUND_RULE}</p>}
                          <p className="mt-3 text-sm">
                            We hold{" "}
                            {workshop ? (people > 1 ? "your seats" : "your seat") : "this time"} for{" "}
                            {holdMinutes} minutes while you pay securely with PayMongo (GCash, card
                            and more).
                          </p>
                        </>
                      )}
                    </div>
                    <Turnstile onToken={onToken} />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </MotionConfig>
        </div>
        {/* The review step already lists everything, so phones skip the summary there. */}
        <BookingSummaryPanel
          className={cn(last && "max-lg:hidden")}
          service={service ?? null}
          addOns={chosenAddOns}
          startAt={startAt || null}
          endAt={endAt}
          vat={vat}
          vatPercent={vatPercent}
          total={total}
          deposit={deposit}
          step={step}
          onGoTo={submitting ? undefined : goTo}
          packageStep={at("package")}
          whenStep={workshop ? null : at("when")}
          people={people}
        />
      </div>

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
            {deposit <= 0
              ? "Request booking"
              : deposit >= total
                ? `Pay ${formatPeso(deposit)}`
                : `Pay ${formatPeso(deposit)} deposit`}
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

const SLIDE = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 32 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -32, transition: { duration: 0.15 } }),
} as const;

/** Numbered steps with a filling line; finished steps can be tapped to go back. */
function StepTracker({
  steps: STEPS,
  step,
  onGoTo,
  disabled,
}: {
  steps: Step[];
  step: number;
  onGoTo: (step: number) => void;
  disabled: boolean;
}) {
  return (
    <nav aria-label="Booking steps">
      <ol className="relative flex justify-between">
        <span aria-hidden className="absolute inset-x-5 top-5 h-0.5 rounded-full bg-muted" />
        <span
          aria-hidden
          className="absolute top-5 left-5 h-0.5 rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `calc((100% - 2.5rem) * ${step / (STEPS.length - 1)})` }}
        />
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.title} className="relative flex w-10 flex-col items-center">
              <button
                type="button"
                onClick={() => onGoTo(i)}
                disabled={!done || disabled}
                aria-current={current ? "step" : undefined}
                aria-label={`${s.title}${done ? " (done, go back)" : current ? " (current step)" : ""}`}
                className={cn(
                  "grid size-10 place-items-center rounded-full border-2 bg-background font-heading text-sm font-semibold transition-all duration-300 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default",
                  done && "border-primary bg-primary text-primary-foreground hover:scale-110",
                  current &&
                    "scale-110 border-primary text-primary shadow-[0_0_0_6px] shadow-primary/15",
                  !done && !current && "border-muted text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-4" aria-hidden /> : i + 1}
              </button>
              <span
                className={cn(
                  "absolute top-12 hidden w-28 text-center text-xs font-semibold sm:block",
                  // Edge labels hug the card's sides instead of hanging past them.
                  i === 0 && "left-0 text-left",
                  i === STEPS.length - 1 && "right-0 text-right",
                  current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.title}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  /** Omitted for details the client can't change (a workshop's time). */
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div className="min-w-0">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="font-semibold break-words">{value}</dd>
      </div>
      {onEdit && (
        <Button type="button" variant="link" className="shrink-0 px-0" onClick={onEdit}>
          Edit<span className="sr-only"> {label.toLowerCase()}</span>
        </Button>
      )}
    </div>
  );
}

/** Workshop step 2: the fixed price, pay half or in full, and the refund rule to accept. */
function WorkshopPayment({
  form,
  service,
  people,
  vatPercent,
  depositPercent,
}: {
  form: UseFormReturn<Values, unknown, Output>;
  service: WizardService;
  people: number;
  vatPercent: number;
  depositPercent: number;
}) {
  const totals = (payInFull: boolean) =>
    bookingTotals({
      packageCents: service.price_cents * people,
      addOnsCents: 0,
      vatPercent,
      fixedDepositCents: null,
      depositPercent,
      payInFull,
    });
  const options = [
    { value: false, label: "Pay half now", cents: totals(false).deposit },
    { value: true, label: "Pay in full", cents: totals(true).deposit },
  ];
  return (
    <FieldGroup>
      <div className="rounded-2xl border bg-card p-4">
        <p className="font-heading text-lg font-semibold">{service.name}</p>
        {service.summary && <p className="text-sm text-muted-foreground">{service.summary}</p>}
        <p className="mt-1 text-sm text-muted-foreground">
          {formatPeso(service.price_cents)} × {people} {people === 1 ? "person" : "people"}
        </p>
        <p className="font-bold">
          {formatPeso(totals(true).total)}
          {vatPercent > 0 && (
            <span className="font-normal text-muted-foreground"> incl. {vatPercent}% VAT</span>
          )}
        </p>
      </div>
      <Controller
        control={form.control}
        name="payInFull"
        render={({ field }) => (
          <div
            role="radiogroup"
            aria-label="How much to pay now"
            className="grid gap-3 sm:grid-cols-2"
          >
            {options.map((o) => {
              const checked = field.value === o.value;
              return (
                <label
                  key={o.label}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border bg-card p-4 transition-all duration-200 hover:border-primary",
                    "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    checked && "border-primary bg-accent/50 ring-1 ring-primary",
                  )}
                >
                  <input
                    type="radio"
                    name={field.name}
                    checked={checked}
                    onChange={() => field.onChange(o.value)}
                    className="sr-only"
                  />
                  <span className="font-semibold">{o.label}</span>
                  <span className="font-heading text-lg font-semibold">{formatPeso(o.cents)}</span>
                </label>
              );
            })}
          </div>
        )}
      />
      <Controller
        control={form.control}
        name="refundRuleAccepted"
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
                <strong className="block">Refund rule</strong>
                {WORKSHOP_REFUND_RULE} I understand and agree.
              </span>
            </label>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </FieldGroup>
  );
}

/** Workshop "Who's coming": 1 to 3 people, priced per person; more than the seats left is disabled. */
function PeoplePicker({
  form,
  priceCents,
  seatsLeft,
}: {
  form: UseFormReturn<Values, unknown, Output>;
  priceCents: number;
  seatsLeft: number | null;
}) {
  return (
    <Controller
      control={form.control}
      name="participants"
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <p className="font-semibold">How many people are joining?</p>
          <p className="text-sm text-muted-foreground">
            {formatPeso(priceCents)} per person · up to {WORKSHOP_MAX_PEOPLE} per sign-up
            {seatsLeft !== null && ` · ${seatsLeft} ${seatsLeft === 1 ? "seat" : "seats"} left`}
          </p>
          <div
            role="radiogroup"
            aria-label="How many people are joining"
            className="grid gap-3 sm:grid-cols-3"
          >
            {Array.from({ length: WORKSHOP_MAX_PEOPLE }, (_, i) => i + 1).map((n) => {
              const checked = field.value === String(n);
              const full = seatsLeft !== null && n > seatsLeft;
              return (
                <label
                  key={n}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border bg-card p-4 transition-all duration-200 hover:border-primary",
                    "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    checked && "border-primary bg-accent/50 ring-1 ring-primary",
                    full && "cursor-not-allowed opacity-50 hover:border-border",
                  )}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={n}
                    checked={checked}
                    disabled={full}
                    onChange={() => field.onChange(String(n))}
                    className="sr-only"
                  />
                  <span className="font-semibold">{n === 1 ? "Just me" : `${n} people`}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatPeso(priceCents * n)}
                  </span>
                </label>
              );
            })}
          </div>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}
