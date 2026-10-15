"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { SelectField, TextAreaField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { ImageUploadField } from "@/components/admin/image-upload-field";
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
import {
  bookingRulesSchema,
  studioProfileSchema,
  type BookingRulesInput,
  type StudioProfileInput,
} from "@/lib/validations/settings";
import { saveBookingRules, saveLogo, saveStudioProfile } from "@/server/actions/settings";
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
      city: settings.city,
      facebookUrl: settings.facebook_url ?? "",
      instagramUrl: settings.instagram_url ?? "",
      tiktokUrl: settings.tiktok_url ?? "",
    },
  });
  const { control } = form;

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
      holdMinutes: String(settings.hold_minutes),
      maxConcurrentBookings: String(settings.max_concurrent_bookings),
    },
  });
  const { control } = form;

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
              description="Travel and setup time after each booking."
            />
            <TextField
              control={control}
              name="defaultDepositPercent"
              label="Default deposit (%)"
              inputMode="numeric"
              description="Services can override this with a fixed amount."
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
              label="Shoots that can run at the same time"
              inputMode="numeric"
              description="1–10. Online bookings and the calendar never go over this."
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
