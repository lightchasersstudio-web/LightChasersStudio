"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import {
  useFieldArray,
  type ArrayPath,
  type Control,
  type FieldArray,
  type FieldValues,
  type Path,
} from "react-hook-form";

import { TextField } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { centsToPesoInput } from "@/lib/utils/money";
import type { AddOnLineInput } from "@/lib/validations/admin-booking";

export type AddOnChoice = { id: string; name: string; priceCents: number; active: boolean };

/**
 * Add-ons on a staff booking or an edit: pick from the catalog (price filled in,
 * still editable) or add a custom extra. Works with any form that has `addOns`.
 */
export function AddOnsEditor<
  F extends FieldValues & { addOns: AddOnLineInput[] },
  T extends FieldValues,
>({ control, catalog }: { control: Control<F, unknown, T>; catalog: AddOnChoice[] }) {
  const { fields, append, remove } = useFieldArray({ control, name: "addOns" as ArrayPath<F> });
  const [pick, setPick] = useState("");
  const add = (line: AddOnLineInput) => append(line as FieldArray<F, ArrayPath<F>>);

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No add-ons on this booking.</p>
      )}
      <ul className="space-y-3">
        {fields.map((field, i) => (
          <li key={field.id} className="grid items-start gap-3 sm:grid-cols-[1fr_9rem_auto]">
            <TextField control={control} name={`addOns.${i}.name` as Path<F>} label="Add-on" />
            <TextField
              control={control}
              name={`addOns.${i}.price` as Path<F>}
              label="Add-on price"
              prefix="₱"
              inputMode="decimal"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="sm:mt-7"
              aria-label={`Remove add-on ${i + 1}`}
              onClick={() => remove(i)}
            >
              <Trash2Icon aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        {catalog.length > 0 && (
          <>
            <label htmlFor="add-on-pick" className="sr-only">
              Add-on from your list
            </label>
            <NativeSelect
              id="add-on-pick"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="min-w-56"
            >
              <NativeSelectOption value="">Choose from your add-ons…</NativeSelectOption>
              {catalog.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.active ? a.name : `${a.name} (hidden)`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="outline"
              disabled={!pick}
              onClick={() => {
                const a = catalog.find((c) => c.id === pick);
                if (a) add({ addOnId: a.id, name: a.name, price: centsToPesoInput(a.priceCents) });
                setPick("");
              }}
            >
              <PlusIcon aria-hidden />
              Add
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => add({ addOnId: "", name: "", price: "" })}
        >
          <PlusIcon aria-hidden />
          Custom extra
        </Button>
      </div>
    </div>
  );
}
