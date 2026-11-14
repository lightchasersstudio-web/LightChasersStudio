"use client";

import { EyeIcon, FileDownIcon } from "lucide-react";
import { useState } from "react";

import { PayslipDetail } from "@/components/admin/payroll/payslip-detail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAmountExact as money } from "@/lib/payroll/money";
import { payrollTotals, type Payslip } from "@/lib/payroll/payslip";
import { cn } from "@/lib/utils";

/**
 * A cut-off's payslips, one line each: days, gross, deductions, net. "View"
 * opens the full payslip (contributions, overtime, time off); "PDF" prints it.
 */
export function PayslipList({
  payslips,
  cutoffLabel,
  cutoffStart,
}: {
  payslips: Payslip[];
  cutoffLabel: string;
  cutoffStart: string;
}) {
  const [open, setOpen] = useState<Payslip | null>(null);
  const pdfHref = (employeeId: string) =>
    `/admin/payroll/pdf?cutoff=${cutoffStart}&employee=${employeeId}`;
  const totals = payrollTotals(payslips);

  return (
    <>
      <ul className="divide-y overflow-hidden rounded-3xl border bg-card" aria-label="Payslips">
        {payslips.map((p) => (
          <li
            key={p.employee_id}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5 lg:grid-cols-[minmax(10rem,1fr)_repeat(4,7.5rem)_auto]"
          >
            <div className="min-w-0">
              <p className="font-semibold break-words">{p.employee_name}</p>
              <p className="text-sm text-muted-foreground">{p.employee_position}</p>
            </div>
            <Figure label="Days" value={String(p.days_present)} className="max-lg:hidden" />
            <Figure label="Gross" value={money(p.gross_pay)} className="max-lg:hidden" />
            <Figure
              label="Deductions"
              value={money(p.total_deductions)}
              className="max-lg:hidden"
            />
            <Figure label="Net pay" value={money(p.net_pay)} strong negative={p.net_pay < 0} />
            <div className="col-span-2 flex gap-2 lg:col-span-1 lg:justify-end">
              <Button
                variant="outline"
                size="sm"
                className="max-lg:flex-1"
                onClick={() => setOpen(p)}
                aria-label={`View ${p.employee_name}'s payslip`}
              >
                <EyeIcon aria-hidden />
                View
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a
                  href={pdfHref(p.employee_id)}
                  target="_blank"
                  rel="noopener"
                  aria-label={`${p.employee_name}'s payslip PDF`}
                >
                  <FileDownIcon aria-hidden />
                  PDF
                </a>
              </Button>
            </div>
          </li>
        ))}
        <li className="flex items-baseline justify-between bg-muted/60 px-4 py-3 font-semibold sm:px-5">
          <span>Total net pay ({payslips.length})</span>
          <span className="tabular-nums">{money(totals.net_pay)}</span>
        </li>
      </ul>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{open.employee_name}</DialogTitle>
                <DialogDescription>
                  {open.employee_position} · payslip for {cutoffLabel}
                </DialogDescription>
              </DialogHeader>
              <PayslipDetail slip={open} />
              <Button asChild variant="outline">
                <a href={pdfHref(open.employee_id)} target="_blank" rel="noopener">
                  <FileDownIcon aria-hidden />
                  Download payslip PDF
                </a>
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Figure({
  label,
  value,
  strong,
  negative,
  className,
}: {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("text-right tabular-nums", className)}>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          strong ? "font-heading text-lg font-semibold" : "font-medium",
          negative && "text-destructive",
        )}
      >
        {value}
      </span>
    </p>
  );
}
