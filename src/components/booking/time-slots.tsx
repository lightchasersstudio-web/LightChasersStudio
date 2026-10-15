"use client";

import { cn } from "@/lib/utils";
import { manilaTime } from "@/lib/utils/business-date";

/** Pill buttons for the free start times of one day. */
export function TimeSlots({
  slots,
  value,
  onChange,
}: {
  slots: string[];
  value: string | null;
  onChange: (iso: string) => void;
}) {
  if (slots.length === 0) {
    return <p className="text-muted-foreground">No times left on this day.</p>;
  }
  return (
    <div role="group" aria-label="Start times" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {slots.map((iso) => {
        const selected = value === iso;
        return (
          <button
            key={iso}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(iso)}
            className={cn(
              "min-h-11 rounded-full border border-primary px-3 text-sm font-bold text-primary transition-colors",
              "hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              selected && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {manilaTime(iso)}
          </button>
        );
      })}
    </div>
  );
}
