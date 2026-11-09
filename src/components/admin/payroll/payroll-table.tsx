"use client";

import { EyeIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PayslipDetail } from "@/components/admin/payroll/payslip-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmountExact } from "@/lib/payroll/money";
import { payrollTotals, type Payslip } from "@/lib/payroll/payslip";
import { cn } from "@/lib/utils";

const money = (v: number) => formatAmountExact(v);

function Contribution({ value }: { value: number | null }) {
  return value === null ? (
    <span className="inline-block text-xs leading-tight whitespace-normal text-muted-foreground">
      Not enrolled
    </span>
  ) : (
    <>{money(value)}</>
  );
}

/** Every payslip of a cut-off, with totals; "View" opens the full payslip. */
export function PayrollTable({
  payslips,
  cutoffLabel,
  cutoffStart,
}: {
  payslips: Payslip[];
  cutoffLabel: string;
  cutoffStart: string;
}) {
  const [open, setOpen] = useState<Payslip | null>(null);
  const totals = payrollTotals(payslips);
  const num = "text-right tabular-nums";

  return (
    <>
      <div className="overflow-hidden rounded-3xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Employee</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead className="text-right">Gross pay</TableHead>
              <TableHead className="text-right">Absences</TableHead>
              <TableHead className="text-right">SSS</TableHead>
              <TableHead className="text-right">PhilHealth</TableHead>
              <TableHead className="text-right">Pag-IBIG</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net pay</TableHead>
              <TableHead className="pr-5">
                <span className="sr-only">Payslip</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payslips.map((p) => {
              const recorded = p.days_present + p.days_absent + p.days_leave + p.days_holiday;
              return (
                <TableRow key={p.employee_id}>
                  <TableCell className="min-w-40 pl-5 whitespace-normal">
                    <span className="font-semibold">{p.employee_name}</span>
                    <span className="block text-muted-foreground">
                      {p.employee_position} · {p.salary_type === "monthly" ? "monthly" : "daily"}
                    </span>
                    {recorded === 0 && (
                      <Badge variant="secondary" className="mt-1">
                        <Link
                          href={`/admin/dtr?cutoff=${cutoffStart}&employee=${p.employee_id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          No time record
                        </Link>
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={num}>
                    {p.days_present}
                    {recorded > p.days_present && (
                      <span className="block text-xs text-muted-foreground">
                        {recorded - p.days_present} off
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={num}>{money(p.gross_pay)}</TableCell>
                  <TableCell className={num}>
                    {p.absence_deduction ? money(p.absence_deduction) : "—"}
                  </TableCell>
                  <TableCell className={num}>
                    <Contribution value={p.sss_deduction} />
                  </TableCell>
                  <TableCell className={num}>
                    <Contribution value={p.philhealth_deduction} />
                  </TableCell>
                  <TableCell className={num}>
                    <Contribution value={p.pagibig_deduction} />
                  </TableCell>
                  <TableCell className={num}>{money(p.total_deductions)}</TableCell>
                  <TableCell
                    className={cn(num, "font-semibold", p.net_pay < 0 && "text-destructive")}
                  >
                    {money(p.net_pay)}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOpen(p)}
                      aria-label={`View ${p.employee_name}'s payslip`}
                    >
                      <EyeIcon aria-hidden />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell className="pl-5">Total ({payslips.length})</TableCell>
              <TableCell />
              <TableCell className={num}>{money(totals.gross_pay)}</TableCell>
              <TableCell className={num}>{money(totals.absence_deduction)}</TableCell>
              <TableCell className={num}>{money(totals.sss)}</TableCell>
              <TableCell className={num}>{money(totals.philhealth)}</TableCell>
              <TableCell className={num}>{money(totals.pagibig)}</TableCell>
              <TableCell className={num}>{money(totals.total_deductions)}</TableCell>
              <TableCell className={num}>{money(totals.net_pay)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

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
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
