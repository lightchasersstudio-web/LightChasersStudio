"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CirclePlusIcon, Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import { FieldGroup } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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

/** Extras clients can tick when booking online; their price is added to the total. */
export function AddOnsManager({ addOns: initial }: { addOns: AddOn[] }) {
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
            Extras clients can tick when booking online, like an extra photographer. The price is
            added to their total and deposit.
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
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AddOnForm({ addOn, onDone }: { addOn?: AddOn; onDone: () => void }) {
  const form = useForm<AddOnFormInput, unknown, z.output<typeof addOnSchema>>({
    resolver: zodResolver(addOnSchema),
    defaultValues: addOn
      ? {
          name: addOn.name,
          description: addOn.description ?? "",
          price: centsToPesoInput(addOn.price_cents),
          // Starter add-ons arrive hidden at ₱0: switch on once a price is set.
          isActive: addOn.is_active,
        }
      : { name: "", description: "", price: "", isActive: true },
  });

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
