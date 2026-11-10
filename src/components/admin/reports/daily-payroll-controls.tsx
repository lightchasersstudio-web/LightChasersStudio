"use client";

import { addDays, format, parseISO } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DAILY_PAYROLL_FILTERS, type DailyPayrollFilter } from "@/lib/payroll/daily-report";

/** Date (with ‹ › by a day) and category for the daily payroll; both live in the URL. */
export function DailyPayrollControls({
  date,
  today,
  filter,
  hasUncategorized,
}: {
  date: string;
  /** Today in Manila. */
  today: string;
  filter: DailyPayrollFilter;
  hasUncategorized: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function go(next: { date?: string; filter?: DailyPayrollFilter }) {
    const q = new URLSearchParams(params);
    const d = next.date ?? date;
    const f = next.filter ?? filter;
    if (d === today) q.delete("payDate");
    else q.set("payDate", d);
    if (f === "all") q.delete("payCategory");
    else q.set("payCategory", f);
    startTransition(() => router.replace(`/admin/reports?${q}#payroll`, { scroll: false }));
  }

  const shift = (days: number) => format(addDays(parseISO(date), days), "yyyy-MM-dd");
  const options =
    hasUncategorized || filter === "none"
      ? [...DAILY_PAYROLL_FILTERS, { value: "none" as const, label: "Uncategorized" }]
      : DAILY_PAYROLL_FILTERS;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="payroll-date">Day</Label>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => go({ date: shift(-1) })}
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Input
            id="payroll-date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && go({ date: e.target.value })}
            className="w-40"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next day"
            onClick={() => go({ date: shift(1) })}
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="payroll-category">Category</Label>
        <NativeSelect
          id="payroll-category"
          value={filter}
          onChange={(e) => go({ filter: e.target.value as DailyPayrollFilter })}
          className="w-40"
        >
          {options.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {date !== today && (
        <Button type="button" variant="ghost" onClick={() => go({ date: today })}>
          Today
        </Button>
      )}
      {pending && (
        <Loader2Icon
          className="mb-3 size-4 animate-spin text-muted-foreground"
          aria-label="Loading"
        />
      )}
    </div>
  );
}
