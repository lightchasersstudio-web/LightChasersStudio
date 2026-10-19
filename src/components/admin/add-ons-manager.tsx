"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CirclePlusIcon, Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { SwitchField, TextAreaField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { moveItem, ReorderButtons } from "@/components/admin/reorder-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils/format";
import { centsToPesoInput, formatPeso } from "@/lib/utils/money";
import { addOnSchema, type AddOnFormInput } from "@/lib/validations/add-ons";
import {
  createAddOn,
  deleteAddOn,
  reorderAddOns,
  setAddOnActive,
  updateAddOn,
} from "@/server/actions/add-ons";
import type { AddOn } from "@/server/queries/add-ons";

export type AddOnPackage = { id: string; name: string; hasSetLength: boolean };

/** Extras clients can tick when booking online; their price is added to the total. */
export function AddOnsManager({
  addOns: initial,
  packages,
}: {
  addOns: AddOn[];
  packages: AddOnPackage[];
}) {
  const [addOns, setAddOns] = useState(initial);
  const [pending, startTransition] = useTransition();
  // null = closed, "new" = adding, otherwise the add-on being edited.
  const [editing, setEditing] = useState<AddOn | "new" | null>(null);
  // Re-sync when the server sends a fresh list (after refresh()).
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setAddOns(initial);
  }

  function move(from: number, to: number) {
    const next = moveItem(addOns, from, to);
    setAddOns(next);
    startTransition(async () => {
      const result = await reorderAddOns({ ids: next.map((a) => a.id) });
      if (!handleResult(result, "")) setAddOns(addOns);
    });
  }

  function toggle(addOn: AddOn, isActive: boolean) {
    setAddOns((list) => list.map((a) => (a.id === addOn.id ? { ...a, is_active: isActive } : a)));
    startTransition(async () => {
      const result = await setAddOnActive({ id: addOn.id, isActive });
      if (
        !handleResult(
          result,
          isActive ? `${addOn.name} is offered when booking.` : `${addOn.name} is hidden.`,
        )
      ) {
        setAddOns((list) => list.map((a) => (a.id === addOn.id ? addOn : a)));
      }
    });
  }

  return (
    <section aria-labelledby="add-ons" className="mt-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="add-ons" className="text-2xl font-semibold">
            Add-ons
          </h2>
          <p className="mt-1 max-w-prose text-muted-foreground">
            Extras clients can tick when booking online, like an extra photographer or more
            photobooth time. The price is added to their total and deposit. Each add-on can be
            limited to the packages it suits.
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditing("new")}>
          <PlusIcon aria-hidden />
          New add-on
        </Button>
      </div>

      {addOns.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          <CirclePlusIcon className="mx-auto size-8 text-terracotta" aria-hidden />
          <p className="mt-3">No add-ons yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {addOns.map((addOn, index) => (
            <li
              key={addOn.id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-all duration-200 hover:border-terracotta/40 hover:shadow-md sm:flex-row sm:items-center",
                !addOn.is_active && "bg-muted/50",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading text-lg font-semibold">{addOn.name}</h3>
                  {!addOn.is_active && <Badge variant="secondary">Hidden</Badge>}
                </div>
                <p className="text-sm">
                  <span className="font-semibold">
                    {addOn.price_cents > 0 ? `+ ${formatPeso(addOn.price_cents)}` : "Free"}
                  </span>
                  {addOn.description && (
                    <span className="text-muted-foreground"> · {addOn.description}</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {addOn.extra_minutes > 0 && (
                    <span className="font-semibold text-terracotta-ink">
                      Adds {formatDuration(addOn.extra_minutes)} ·{" "}
                    </span>
                  )}
                  {offeredWith(addOn, packages)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-3 sm:border-0 sm:pt-0">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <Switch
                    checked={addOn.is_active}
                    onCheckedChange={(v) => toggle(addOn, v)}
                    disabled={pending}
                    aria-label={`Offer ${addOn.name} when booking`}
                  />
                  <span className="sm:sr-only">Offered</span>
                </label>
                <div className="flex items-center">
                  <ReorderButtons
                    index={index}
                    count={addOns.length}
                    name={addOn.name}
                    disabled={pending}
                    onMove={move}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${addOn.name}`}
                    onClick={() => setEditing(addOn)}
                  >
                    <PencilIcon aria-hidden />
                  </Button>
                  <ConfirmDelete
                    label={`Delete ${addOn.name}`}
                    title={`Delete “${addOn.name}”?`}
                    description="Bookings that already include it keep it. To stop offering it for now, switch it off instead."
                    onConfirm={async () =>
                      handleResult(await deleteAddOn({ id: addOn.id }), "Add-on deleted.")
                    }
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          {editing !== null && (
            <AddOnForm
              key={editing === "new" ? "new" : editing.id}
              addOn={editing === "new" ? undefined : editing}
              packages={packages}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** "With every package" / "Only with: Photobooth" / "Not offered with: …" */
function offeredWith(addOn: AddOn, packages: AddOnPackage[]): string {
  if (addOn.service_ids.length === 0) return "With every package";
  const names = (ids: string[]) =>
    packages
      .filter((p) => ids.includes(p.id))
      .map((p) => p.name)
      .join(", ");
  const left = packages.filter((p) => !addOn.service_ids.includes(p.id));
  if (left.length === 0) return "With every package";
  return addOn.service_ids.length <= left.length
    ? `Only with: ${names(addOn.service_ids) || "no packages"}`
    : `Not with: ${names(left.map((p) => p.id))}`;
}

function AddOnForm({
  addOn,
  packages,
  onDone,
}: {
  addOn?: AddOn;
  packages: AddOnPackage[];
  onDone: () => void;
}) {
  const form = useForm<AddOnFormInput, unknown, z.output<typeof addOnSchema>>({
    resolver: zodResolver(addOnSchema),
    defaultValues: addOn
      ? {
          name: addOn.name,
          description: addOn.description ?? "",
          price: centsToPesoInput(addOn.price_cents),
          // Starter add-ons arrive hidden at ₱0: switch on once a price is set.
          isActive: addOn.is_active,
          addsHours: addOn.extra_minutes ? String(addOn.extra_minutes / 60) : "",
          serviceIds: addOn.service_ids,
        }
      : { name: "", description: "", price: "", isActive: true, addsHours: "", serviceIds: [] },
  });
  const serviceIds = useWatch({ control: form.control, name: "serviceIds" });
  const timedPackages = packages.filter((p) => p.hasSetLength);

  async function onSubmit() {
    const values = form.getValues();
    const saved = addOn
      ? handleResult(await updateAddOn(addOn.id, values), "Add-on saved.", form)
      : handleResult(await createAddOn(values), "Add-on added.", form);
    if (saved) onDone();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle>{addOn ? "Edit add-on" : "New add-on"}</DialogTitle>
        <DialogDescription>
          Price changes apply to new bookings only. Existing bookings keep what they were booked at.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <TextField
          control={form.control}
          name="name"
          label="Name"
          maxLength={80}
          placeholder="Extra photographer"
        />
        <TextField
          control={form.control}
          name="price"
          label="Price"
          prefix="₱"
          inputMode="decimal"
          className="max-w-48"
        />
        <TextAreaField
          control={form.control}
          name="description"
          label="Short description (optional)"
          rows={2}
          maxLength={300}
          description="Shown under the name when clients book."
        />
        <Controller
          control={form.control}
          name="serviceIds"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">Offered with</legend>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={field.value.length === 0}
                    onChange={(e) =>
                      field.onChange(e.target.checked ? [] : packages.map((p) => p.id))
                    }
                    className="size-5 accent-primary"
                  />
                  Every package
                </label>
                {serviceIds.length > 0 && (
                  <div className="grid gap-1 sm:grid-cols-2">
                    {packages.map((p) => (
                      <label
                        key={p.id}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={field.value.includes(p.id)}
                          onChange={(e) =>
                            field.onChange(
                              e.target.checked
                                ? [...field.value, p.id]
                                : field.value.filter((id) => id !== p.id),
                            )
                          }
                          className="size-5 shrink-0 accent-primary"
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
              <FieldDescription>
                Clients only see it when they pick one of these packages.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <TextField
          control={form.control}
          name="addsHours"
          label="Adds time (hours, optional)"
          inputMode="decimal"
          placeholder="e.g. 1"
          className="max-w-48"
          description={
            timedPackages.length > 0
              ? `For extensions: lengthens packages with a set length (${timedPackages.map((p) => p.name).join(", ")}). Leave empty otherwise.`
              : "For extensions of packages with a set length. Leave empty otherwise."
          }
        />
        <SwitchField
          control={form.control}
          name="isActive"
          label="Offer when booking"
          description="Switch off to hide it from the booking form."
        />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          {addOn ? "Save" : "Add"}
        </Button>
      </DialogFooter>
    </form>
  );
}
