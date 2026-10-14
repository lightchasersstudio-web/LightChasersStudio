"use client";

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// Thin Controller wrappers so every admin form gets labels, descriptions and
// inline errors wired up the same (accessible) way.

type Base<F extends FieldValues, T extends FieldValues> = {
  control: Control<F, unknown, T>;
  name: Path<F>;
  label: string;
  description?: React.ReactNode;
  className?: string;
};

export function TextField<F extends FieldValues, T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  prefix,
  ...input
}: Base<F, T> &
  Pick<
    React.ComponentProps<"input">,
    "type" | "inputMode" | "autoComplete" | "placeholder" | "maxLength" | "min" | "max"
  > & { prefix?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <div className="relative">
            {prefix && (
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground">
                {prefix}
              </span>
            )}
            <Input
              {...field}
              {...input}
              id={name}
              value={String(field.value ?? "")}
              aria-invalid={fieldState.invalid}
              aria-describedby={description ? `${name}-desc` : undefined}
              className={prefix ? "pl-8" : undefined}
            />
          </div>
          {description && <FieldDescription id={`${name}-desc`}>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

export function TextAreaField<F extends FieldValues, T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  rows = 4,
  maxLength,
  placeholder,
}: Base<F, T> & { rows?: number; maxLength?: number; placeholder?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Textarea
            {...field}
            id={name}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            value={String(field.value ?? "")}
            aria-invalid={fieldState.invalid}
            aria-describedby={description ? `${name}-desc` : undefined}
          />
          {description && <FieldDescription id={`${name}-desc`}>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

export function SelectField<F extends FieldValues, T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  options,
}: Base<F, T> & { options: { value: string; label: string }[] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <NativeSelect
            {...field}
            id={name}
            value={String(field.value ?? "")}
            aria-invalid={fieldState.invalid}
            className="w-full"
          >
            {options.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

export function SwitchField<F extends FieldValues, T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
}: Base<F, T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" className={className}>
          <FieldContent>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            {description && <FieldDescription>{description}</FieldDescription>}
          </FieldContent>
          <Switch
            id={name}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            onBlur={field.onBlur}
          />
        </Field>
      )}
    />
  );
}
