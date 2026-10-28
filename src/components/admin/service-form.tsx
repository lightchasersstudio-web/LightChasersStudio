"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { handleResult } from "@/components/admin/form-utils";
import { SelectField, SwitchField, TextAreaField, TextField } from "@/components/admin/form-fields";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { useUnsavedChangesWarning } from "@/components/admin/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PACKAGE_CATEGORIES } from "@/lib/catalog";
import { centsToPesoInput } from "@/lib/utils/money";
import {
  serviceSchema,
  slugify,
  workshopFormValues,
  type ServiceFormInput,
} from "@/lib/validations/services";
import { createService, updateService } from "@/server/actions/services";
import type { Service } from "@/server/queries/services";

export function ServiceForm({ service }: { service?: Service }) {
  const router = useRouter();
  const form = useForm<ServiceFormInput, unknown, z.output<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: service
      ? {
          name: service.name,
          slug: service.slug,
          category: service.category,
          summary: service.summary ?? "",
          description: service.description ?? "",
          hasSetLength: service.duration_minutes !== null,
          lengthHours:
            service.duration_minutes === null ? "" : String(service.duration_minutes / 60),
          price: centsToPesoInput(service.price_cents),
          depositMode: service.deposit_cents === null ? "default" : "fixed",
          deposit: service.deposit_cents === null ? "" : centsToPesoInput(service.deposit_cents),
          inclusions: (service.inclusions as string[]).join("\n"),
          coverImagePath: service.cover_image_path,
          isActive: service.is_active,
          ...workshopFormValues(service),
        }
      : {
          name: "",
          slug: "",
          category: "portrait",
          summary: "",
          description: "",
          hasSetLength: false,
          lengthHours: "",
          price: "",
          depositMode: "default",
          deposit: "",
          inclusions: "",
          coverImagePath: null,
          isActive: true,
          workshopDate: "",
          workshopStart: "",
          workshopEnd: "",
          workshopSeats: "",
          workshopLocation: "",
          earlyBirdPrice: "",
          earlyBirdUntil: "",
          earlyBirdSeats: "",
          studentPrice: "",
          regularEnabled: true,
          earlyBirdEnabled: false,
          studentEnabled: false,
        },
  });
  const { control } = form;
  useUnsavedChangesWarning(form.formState.isDirty);
  const [depositMode, hasSetLength, category, price, earlyBirdEnabled, studentEnabled] = useWatch({
    control,
    name: [
      "depositMode",
      "hasSetLength",
      "category",
      "price",
      "earlyBirdEnabled",
      "studentEnabled",
    ],
  });

  async function onSubmit() {
    const values = form.getValues();
    if (service) {
      const result = await updateService(service.id, values);
      if (handleResult(result, "Service saved.", form)) form.reset(values);
    } else {
      const result = await createService(values);
      if (handleResult(result, "Service created.", form)) {
        router.push(`/admin/services/${result.data.id}`);
      }
    }
  }

  return (
    <form
      // Never fail silently: say why it didn't save, even for a field that isn't on screen.
      onSubmit={form.handleSubmit(onSubmit, (errors) =>
        toast.error(
          Object.values(errors).find((e) => e?.message)?.message ??
            "Please check the highlighted fields.",
        ),
      )}
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:grid-rows-[auto_1fr]"
    >
      <div className="space-y-6 lg:row-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>What clients see on the services page.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Controller
                control={control}
                name="name"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="name">Service name</FieldLabel>
                    <Input
                      {...field}
                      id="name"
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g. Prenup Session"
                      onChange={(e) => {
                        field.onChange(e);
                        // Keep the URL name in sync until the admin edits it by hand.
                        if (!form.getFieldState("slug").isDirty && !service) {
                          form.setValue("slug", slugify(e.target.value));
                        }
                      }}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  control={control}
                  name="slug"
                  label="URL name"
                  description="Used in the link, e.g. /services/prenup-session"
                />
                <SelectField
                  control={control}
                  name="category"
                  label="Category"
                  options={PACKAGE_CATEGORIES}
                />
              </div>
              <TextField
                control={control}
                name="summary"
                label="Short summary"
                description="One line for service cards (optional)."
                maxLength={300}
              />
              <TextAreaField
                control={control}
                name="description"
                label="Description"
                rows={6}
                maxLength={5000}
              />
              <TextAreaField
                control={control}
                name="inclusions"
                label="What's included"
                description="One item per line, e.g. “50 edited photos”."
                rows={5}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Price & length</CardTitle>
            <CardDescription>Prices are in Philippine pesos.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <TextField
                control={control}
                name="price"
                label="Price"
                prefix="₱"
                inputMode="decimal"
                placeholder="15000"
                className="sm:max-w-[calc(50%-0.625rem)]"
              />
              <SwitchField
                control={control}
                name="hasSetLength"
                label="This package has a set length"
                description="Only for packages like the Photobooth (4 hours). Others are booked by start time only, with no end time."
              />
              {hasSetLength && (
                <TextField
                  control={control}
                  name="lengthHours"
                  label="Length (hours)"
                  inputMode="decimal"
                  placeholder="4"
                  description="Clients can add more time with an add-on that adds hours."
                  className="sm:max-w-[calc(50%-0.625rem)]"
                />
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField
                  control={control}
                  name="depositMode"
                  label="Deposit"
                  options={[
                    { value: "default", label: "Use the default deposit %" },
                    { value: "fixed", label: "Fixed amount" },
                  ]}
                  description="The default % is set in Settings."
                />
                {depositMode === "fixed" && (
                  <TextField
                    control={control}
                    name="deposit"
                    label="Deposit amount"
                    prefix="₱"
                    inputMode="decimal"
                  />
                )}
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        {category === "workshop" && (
          <Card>
            <CardHeader>
              <CardTitle>Workshop schedule</CardTitle>
              <CardDescription>
                Clients don&apos;t pick a time or place: everyone who signs up joins this date, time
                and location. Leave the date empty until it&apos;s decided (sign-up stays closed).
                Changing it moves everyone already signed up, so let them know.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-5 sm:grid-cols-3">
                  <TextField control={control} name="workshopDate" label="Date" type="date" />
                  <TextField control={control} name="workshopStart" label="Starts" type="time" />
                  <TextField control={control} name="workshopEnd" label="Ends" type="time" />
                </div>
                <TextField
                  control={control}
                  name="workshopLocation"
                  label="Location"
                  placeholder="e.g. Light Chasers Studio, 3rd floor, MPO Building, Tetuan"
                  maxLength={300}
                />
                <TextField
                  control={control}
                  name="workshopSeats"
                  label="Seats"
                  inputMode="numeric"
                  placeholder="e.g. 15"
                  description="How many people can join. Leave empty for no limit."
                  className="sm:max-w-[calc(33%-0.5rem)]"
                />
              </FieldGroup>
            </CardContent>
          </Card>
        )}

        {category === "workshop" && (
          <Card>
            <CardHeader>
              <CardTitle>Price categories</CardTitle>
              <CardDescription>
                Each person picks one, per person. Switch any of them off to stop offering it
                (people already signed up keep theirs). With all three off, sign-up is paused.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="divide-y [&>*]:pt-5 [&>*:first-child]:pt-0">
                <SwitchField
                  control={control}
                  name="regularEnabled"
                  label="Regular"
                  description={`Uses the price above${price ? ` (₱${price})` : ""}.`}
                />
                <div className="space-y-4">
                  <SwitchField
                    control={control}
                    name="earlyBirdEnabled"
                    label="Early bird"
                    description="Closes on its own after the last day or when the places run out."
                  />
                  {earlyBirdEnabled && (
                    <div className="grid gap-5 sm:grid-cols-3">
                      <TextField
                        control={control}
                        name="earlyBirdPrice"
                        label="Price"
                        prefix="₱"
                        inputMode="decimal"
                        placeholder="4000"
                      />
                      <TextField
                        control={control}
                        name="earlyBirdUntil"
                        label="Until"
                        type="date"
                        description="Last day. Empty = no end date."
                      />
                      <TextField
                        control={control}
                        name="earlyBirdSeats"
                        label="Places"
                        inputMode="numeric"
                        placeholder="25"
                        description="Empty = no limit."
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <SwitchField
                    control={control}
                    name="studentEnabled"
                    label="Student"
                    description="Students upload an ID, which you accept or reject on the booking."
                  />
                  {studentEnabled && (
                    <TextField
                      control={control}
                      name="studentPrice"
                      label="Price"
                      prefix="₱"
                      inputMode="decimal"
                      placeholder="4000"
                      className="sm:max-w-[calc(33%-0.5rem)]"
                    />
                  )}
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cover photo</CardTitle>
            <CardDescription>Landscape works best.</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={control}
              name="coverImagePath"
              render={({ field }) => (
                <ImageUploadField
                  bucket="portfolio"
                  folder="services"
                  value={field.value}
                  onChange={(path) => field.onChange(path)}
                  maxEdge={1920}
                  label="service cover photo"
                />
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <SwitchField
              control={control}
              name="isActive"
              label="Bookable"
              description="Turn off to hide this service from clients."
            />
          </CardContent>
        </Card>
      </div>

      {/* Direct child of the form so it stays pinned for the whole form on phones. */}
      <div className="sticky bottom-4 z-10 flex gap-2 rounded-full border bg-background/90 p-2 shadow-lg backdrop-blur lg:static lg:col-start-2 lg:row-start-2 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={() => router.push("/admin/services")}
        >
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          {service ? "Save changes" : "Create service"}
        </Button>
      </div>
    </form>
  );
}
