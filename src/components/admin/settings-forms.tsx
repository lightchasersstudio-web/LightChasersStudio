"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { SelectField, TextAreaField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { useUnsavedChangesWarning } from "@/components/admin/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { centsToPesoInput } from "@/lib/utils/money";
import {
  bookingRulesSchema,
  chargePricesSchema,
  studioPolicySchema,
  studioProfileSchema,
  type BookingRulesInput,
  type ChargePricesInput,
  type StudioPolicyInput,
  type StudioProfileInput,
} from "@/lib/validations/settings";
import {
  saveBookingRules,
  saveChargePrices,
  saveLogo,
  saveStudioPolicy,
  saveStudioProfile,
} from "@/server/actions/settings";
import type { BusinessSettings } from "@/server/queries/settings";

function SaveButton({
  pending,
  dirty,
  children,
}: {
  pending: boolean;
  dirty: boolean;
  children: string;
}) {
  return (
    <Button type="submit" disabled={pending || !dirty} className="w-full sm:w-auto">
      {pending && <Loader2Icon className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

export function StudioProfileForm({ settings }: { settings: BusinessSettings }) {
  const form = useForm<StudioProfileInput, unknown, z.output<typeof studioProfileSchema>>({
    resolver: zodResolver(studioProfileSchema),
    defaultValues: {
      businessName: settings.business_name,
      tagline: settings.tagline ?? "",
      about: settings.about ?? "",
      email: settings.email ?? "",
      phone: settings.phone ?? "",
      address: settings.address ?? "",
      mapsUrl: settings.maps_url ?? "",
      city: settings.city,
      facebookUrl: settings.facebook_url ?? "",
      instagramUrl: settings.instagram_url ?? "",
      tiktokUrl: settings.tiktok_url ?? "",
    },
  });
  const { control } = form;
  useUnsavedChangesWarning(form.formState.isDirty);

  async function onSubmit() {
    const values = form.getValues();
    if (handleResult(await saveStudioProfile(values), "Studio profile saved.", form))
      form.reset(values);
  }

  return (
    <Card id="profile">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-(--card-spacing)"
      >
        <CardHeader>
          <CardTitle>Studio profile</CardTitle>
          <CardDescription>
            Shown on the public site: home, about and contact pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                control={control}
                name="businessName"
                label="Studio name"
                maxLength={120}
              />
              <TextField
                control={control}
                name="tagline"
                label="Tagline"
                maxLength={200}
                placeholder="Chasing the light in Zamboanga"
              />
            </div>
            <TextAreaField
              control={control}
              name="about"
              label="About the studio"
              rows={6}
              maxLength={5000}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                control={control}
                name="email"
                label="Contact email"
                type="email"
                inputMode="email"
                autoComplete="email"
              />
              <TextField
                control={control}
                name="phone"
                label="Phone / mobile"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0917 123 4567"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
              <TextField control={control} name="address" label="Studio address" maxLength={300} />
              <TextField control={control} name="city" label="City" maxLength={80} />
            </div>
            <TextField
              control={control}
              name="mapsUrl"
              label="Google Maps link"
              type="url"
              placeholder="https://maps.app.goo.gl/…"
              maxLength={500}
              description="So the address opens your exact spot: in Google Maps, find your studio's pin, tap Share, copy the link and paste it here. Empty = Google searches for the address."
            />
            <div className="grid gap-5 lg:grid-cols-3">
              <TextField
                control={control}
                name="facebookUrl"
                label="Facebook page"
                type="url"
                placeholder="https://facebook.com/…"
              />
              <TextField
                control={control}
                name="instagramUrl"
                label="Instagram"
                type="url"
                placeholder="https://instagram.com/…"
              />
              <TextField
                control={control}
                name="tiktokUrl"
                label="TikTok"
                type="url"
                placeholder="https://tiktok.com/@…"
              />
            </div>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <SaveButton pending={form.formState.isSubmitting} dirty={form.formState.isDirty}>
            Save profile
          </SaveButton>
        </CardFooter>
      </form>
    </Card>
  );
}

export function LogoForm({ logoPath }: { logoPath: string | null }) {
  const [value, setValue] = useState(logoPath);
  const [saving, setSaving] = useState(false);

  async function save(next: string | null) {
    setValue(next);
    setSaving(true);
    const ok = handleResult(
      await saveLogo({ logoPath: next }),
      next ? "Logo updated." : "Logo removed.",
    );
    setSaving(false);
    if (!ok) setValue(logoPath);
  }

  return (
    <Card id="logo">
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <CardDescription>
          Used in the site header and emails. Until you upload one, the built-in Light Chasers logo
          is used. Square images with a white or transparent background work best.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ImageUploadField
          bucket="brand"
          folder="logo"
          value={value}
          onChange={save}
          maxEdge={1024}
          aspect="aspect-square max-w-48"
          label="studio logo"
        />
        {saving && (
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            Saving…
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function BookingRulesForm({ settings }: { settings: BusinessSettings }) {
  const form = useForm<BookingRulesInput, unknown, z.output<typeof bookingRulesSchema>>({
    resolver: zodResolver(bookingRulesSchema),
    defaultValues: {
      minNoticeHours: String(settings.min_notice_hours),
      maxAdvanceDays: String(settings.max_advance_days),
      slotIntervalMinutes: String(settings.slot_interval_minutes) as "15" | "30" | "60",
      bufferMinutes: String(settings.buffer_minutes),
      defaultDepositPercent: String(settings.default_deposit_percent),
      eventsDepositPercent: String(settings.events_deposit_percent),
      vatPercent: String(settings.vat_percent),
      holdMinutes: String(settings.hold_minutes),
      maxConcurrentBookings: String(settings.max_concurrent_bookings),
      personalDataDays: String(settings.personal_data_days),
    },
  });
  const { control } = form;
  useUnsavedChangesWarning(form.formState.isDirty);

  async function onSubmit() {
    const values = form.getValues();
    if (handleResult(await saveBookingRules(values), "Booking rules saved.", form))
      form.reset(values);
  }

  return (
    <Card id="booking-rules" className="scroll-mt-24">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-(--card-spacing)"
      >
        <CardHeader>
          <CardTitle>Booking rules</CardTitle>
          <CardDescription>
            These control which times clients can pick and how deposits work. Changes apply to new
            bookings only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <TextField
              control={control}
              name="minNoticeHours"
              label="Minimum notice (hours)"
              inputMode="numeric"
              description="How far ahead clients must book. 48 = two days."
            />
            <TextField
              control={control}
              name="maxAdvanceDays"
              label="Book up to (days ahead)"
              inputMode="numeric"
              description="e.g. 180 ≈ six months."
            />
            <SelectField
              control={control}
              name="slotIntervalMinutes"
              label="Start times every"
              options={[
                { value: "15", label: "15 minutes" },
                { value: "30", label: "30 minutes" },
                { value: "60", label: "1 hour" },
              ]}
            />
            <TextField
              control={control}
              name="bufferMinutes"
              label="Buffer between sessions (minutes)"
              inputMode="numeric"
              description="Gap after each studio session before the next can start. 0 = back to back."
            />
            <TextField
              control={control}
              name="defaultDepositPercent"
              label="Studio down payment (%)"
              inputMode="numeric"
              description="Portraits, studio, product and other non-event packages."
            />
            <TextField
              control={control}
              name="eventsDepositPercent"
              label="Events down payment (%)"
              inputMode="numeric"
              description="Weddings, prenups and the Photobooth. Pick each package's group in Services; a fixed amount there overrides both."
            />
            <TextField
              control={control}
              name="vatPercent"
              label="VAT added to online bookings (%)"
              inputMode="numeric"
              description="Added on top of package + add-ons. Use 0 if you're not VAT-registered."
            />
            <TextField
              control={control}
              name="holdMinutes"
              label="Payment window (minutes)"
              inputMode="numeric"
              description="How long an unpaid booking holds the slot."
            />
            <TextField
              control={control}
              name="maxConcurrentBookings"
              label="Studio sessions at the same time"
              inputMode="numeric"
              description="Usually 1. Outside events (weddings, prenups) are one per day and don't count here; set each package's type in Services."
            />
            <TextField
              control={control}
              name="personalDataDays"
              label="Delete client details after (days)"
              inputMode="numeric"
              description="Days after their last booking (studio policy 7.2). Not while a booking, refund, unpaid balance or request is open. Amounts and receipts stay. 0 = never."
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <SaveButton pending={form.formState.isSubmitting} dirty={form.formState.isDirty}>
            Save booking rules
          </SaveButton>
        </CardFooter>
      </form>
    </Card>
  );
}

/**
 * The Studio Policy Manual & Client Agreement. Clients booking a studio package
 * must tick "I agree" to it on Review & pay; each booking keeps the copy agreed to.
 */
export function StudioPolicyForm({ settings }: { settings: BusinessSettings }) {
  const form = useForm<StudioPolicyInput, unknown, z.output<typeof studioPolicySchema>>({
    resolver: zodResolver(studioPolicySchema),
    defaultValues: { studioPolicy: settings.studio_policy },
  });
  useUnsavedChangesWarning(form.formState.isDirty);

  async function onSubmit() {
    const values = form.getValues();
    if (handleResult(await saveStudioPolicy(values), "Studio policy saved.", form))
      form.reset(values);
  }

  return (
    <Card id="studio-policy" className="scroll-mt-24">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-(--card-spacing)"
      >
        <CardHeader>
          <CardTitle>Studio policy</CardTitle>
          <CardDescription>
            Shown on the last booking step for studio packages (booking type “Studio” in Services),
            below the package contract. Clients must tick “I agree” to book. Bookings keep the
            wording they agreed to, so editing it only affects new bookings. Leave it empty to stop
            asking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TextAreaField
            control={form.control}
            name="studioPolicy"
            label="Studio Policy Manual & Client Agreement"
            rows={18}
            maxLength={60000}
            description="Plain text. Blank lines separate paragraphs."
          />
        </CardContent>
        <CardFooter className="justify-end">
          <SaveButton pending={form.formState.isSubmitting} dirty={form.formState.isDirty}>
            Save studio policy
          </SaveButton>
        </CardFooter>
      </form>
    </Card>
  );
}

/** Preset prices for extra charges after a shoot (studio policy 3.2, 4.4, 5.1, 7.8). */
export function ChargePricesForm({ settings }: { settings: BusinessSettings }) {
  const form = useForm<ChargePricesInput, unknown, z.output<typeof chargePricesSchema>>({
    resolver: zodResolver(chargePricesSchema),
    defaultValues: {
      cleaningFee: centsToPesoInput(settings.cleaning_fee_cents),
      backdropPaperYard: centsToPesoInput(settings.backdrop_paper_yard_cents),
      extraPerson: centsToPesoInput(settings.extra_person_cents),
      storageDay: centsToPesoInput(settings.storage_day_cents),
      securityDeposit: centsToPesoInput(settings.security_deposit_cents),
    },
  });
  const { control } = form;
  useUnsavedChangesWarning(form.formState.isDirty);

  async function onSubmit() {
    const values = form.getValues();
    if (handleResult(await saveChargePrices(values), "Extra charge prices saved.", form))
      form.reset(values);
  }

  return (
    <Card id="extra-charges" className="scroll-mt-24">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-(--card-spacing)"
      >
        <CardHeader>
          <CardTitle>Extra charges</CardTitle>
          <CardDescription>
            Preset prices staff can add to a booking after a shoot (booking page → Payments → Add a
            charge). Before VAT. Damage is typed in each time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              control={control}
              name="cleaningFee"
              label="Cleaning fee"
              prefix="₱"
              inputMode="decimal"
              description="Studio left dirty (policy 4.4)."
            />
            <TextField
              control={control}
              name="backdropPaperYard"
              label="Backdrop paper, per yard"
              prefix="₱"
              inputMode="decimal"
              description="Soiled or torn seamless paper cut off (3.2)."
            />
            <TextField
              control={control}
              name="extraPerson"
              label="Extra person, each"
              prefix="₱"
              inputMode="decimal"
              description="Beyond the package limit or 8 people (5.1)."
            />
            <TextField
              control={control}
              name="storageDay"
              label="Storage of left-behind items, per day"
              prefix="₱"
              inputMode="decimal"
              description="After the free 24 hours (7.8)."
            />
            <TextField
              control={control}
              name="securityDeposit"
              label="Security deposit (refundable)"
              prefix="₱"
              inputMode="decimal"
              description="For pets or messy materials (3.9). Collected and returned on the Today page."
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <SaveButton pending={form.formState.isSubmitting} dirty={form.formState.isDirty}>
            Save prices
          </SaveButton>
        </CardFooter>
      </form>
    </Card>
  );
}
