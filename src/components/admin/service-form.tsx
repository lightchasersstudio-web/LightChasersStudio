"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { handleResult } from "@/components/admin/form-utils";
import { SelectField, SwitchField, TextAreaField, TextField } from "@/components/admin/form-fields";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SERVICE_CATEGORIES } from "@/lib/catalog";
import { centsToPesoInput } from "@/lib/utils/money";
import { serviceSchema, slugify, type ServiceFormInput } from "@/lib/validations/services";
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
          durationMinutes: String(service.duration_minutes),
          price: centsToPesoInput(service.price_cents),
          depositMode: service.deposit_cents === null ? "default" : "fixed",
          deposit: service.deposit_cents === null ? "" : centsToPesoInput(service.deposit_cents),
          inclusions: (service.inclusions as string[]).join("\n"),
          coverImagePath: service.cover_image_path,
          isActive: service.is_active,
        }
      : {
          name: "",
          slug: "",
          category: "portrait",
          summary: "",
          description: "",
          durationMinutes: "60",
          price: "",
          depositMode: "default",
          deposit: "",
          inclusions: "",
          coverImagePath: null,
          isActive: true,
        },
  });
  const { control } = form;
  const depositMode = useWatch({ control, name: "depositMode" });

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
      onSubmit={form.handleSubmit(onSubmit)}
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
                  options={SERVICE_CATEGORIES}
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
            <CardTitle>Price & duration</CardTitle>
            <CardDescription>Prices are in Philippine pesos.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  control={control}
                  name="price"
                  label="Price"
                  prefix="₱"
                  inputMode="decimal"
                  placeholder="15000"
                />
                <TextField
                  control={control}
                  name="durationMinutes"
                  label="Session length (minutes)"
                  inputMode="numeric"
                />
              </div>
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
