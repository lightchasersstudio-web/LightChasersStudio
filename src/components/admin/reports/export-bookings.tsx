"use client";

import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUSINESS_TZ } from "@/lib/utils/business-date";

/** Download one month of real bookings and payments as a spreadsheet (CSV). */
export function ExportBookings() {
  const [month, setMonth] = useState(() => format(TZDate.tz(BUSINESS_TZ), "yyyy-MM"));
  return (
    <section
      aria-labelledby="export"
      className="mb-6 flex flex-wrap items-end gap-3 rounded-3xl border bg-card p-5"
    >
      <div className="min-w-0 flex-1">
        <h2 id="export" className="text-xl font-semibold">
          Export bookings
        </h2>
        <p className="text-sm text-muted-foreground">
          Your real bookings for a month, with VAT, payments and balances. Opens in Excel or Google
          Sheets.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="export-month">Month</Label>
        <Input
          id="export-month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
        />
      </div>
      <Button asChild disabled={!month}>
        <a href={`/admin/reports/export?month=${month}`} download>
          <DownloadIcon aria-hidden />
          Download CSV
        </a>
      </Button>
    </section>
  );
}
