"use client";

import { EyeIcon, FileDownIcon } from "lucide-react";
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
import { formatMinutes } from "@/lib/payroll/cutoff";
import { formatAmountExact, toCents, toPesos } from "@/lib/payroll/money";
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
  saved = false,
}: {
  payslips: Payslip[];
  cutoffLabel: string;
  cutoffStart: string;
  /** Saved payslips: offer each one as a PDF. */
  saved?: boolean;
}) {
  const [open, setOpen] = useState<Payslip | null>(null);
  const pdfHref = (employeeId: string) =>
    `/admin/payroll/pdf?cutoff=${cutoffStart}&employee=${employeeId}`;
  const totals = payrollTotals(payslips);
  const num = "text-right tabular-nums";

  return (
    <>
      {/* Phones: a card per person (the table is too wide). */}
      <ul className="space-y-3 xl:hidden" aria-label="Payslips">
        {payslips.map((p) => {
          const recorded = p.days_present + p.days_absent + p.days_leave + p.days_holiday;
          return (
            <li key={p.employee_id} className="rounded-3xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{p.employee_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.employee_position} · {p.salary_type === "monthly" ? "monthly" : "daily"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">Net pay</p>
                  <p
                    className={cn(
                      "font-heading text-lg font-semibold tabular-nums",
                      p.net_pay < 0 && "text-destructive",
                    )}
                  >
                    {money(p.net_pay)}
                  </p>
                </div>
              </div>
              {recorded === 0 && (
                <Badge variant="secondary" className="mt-2">
                  <Link
                    href={`/admin/dtr?cutoff=${cutoffStart}&employee=${p.employee_id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    No time record
                  </Link>
                </Badge>
              )}
              <dl className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-muted/60 p-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Days</dt>
                  <dd className="font-semibold tabular-nums">{p.days_present}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Gross</dt>
                  <dd className="font-semibold tabular-nums">{money(p.gross_pay)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Deductions</dt>
                  <dd className="font-semibold tabular-nums">{money(p.total_deductions)}</dd>
                </div>
              </dl>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOpen(p)}
                  aria-label={`View ${p.employee_name}'s payslip`}
                >
                  <EyeIcon aria-hidden />
                  View payslip
                </Button>
                {saved && (
                  <Button asChild variant="ghost">
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
                )}
              </div>
            </li>
          );
        })}
        <li className="flex items-baseline justify-between rounded-3xl bg-muted/60 px-4 py-3 text-sm font-semibold">
          <span>Total net pay ({payslips.length})</span>
          <span className="tabular-nums">{money(totals.net_pay)}</span>
        </li>
      </ul>

      <div className="hidden overflow-hidden rounded-3xl border bg-card xl:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Employee</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead className="text-right">Gross pay</TableHead>
              <TableHead className="text-right">Time off</TableHead>
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
                  <TableCell className={num}>
                    {money(p.gross_pay)}
                    {p.overtime_pay > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        incl. {money(p.overtime_pay)} overtime
                      </span>
                    )}
                  </TableCell>
                  <TableCell className={num}>
                    {/* Absences + undertime */}
                    {p.absence_deduction + p.undertime_deduction
                      ? money(
                          toPesos(toCents(p.absence_deduction) + toCents(p.undertime_deduction)),
                        )
                      : "—"}
                    {p.undertime_minutes > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {formatMinutes(p.undertime_minutes)} short
                      </span>
                    )}
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
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen(p)}
                        aria-label={`View ${p.employee_name}'s payslip`}
                      >
                        <EyeIcon aria-hidden />
                        View
                      </Button>
                      {saved && (
                        <Button asChild variant="ghost" size="sm">
                          {/* A route handler: a plain link opens the PDF in a new tab. */}
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
                      )}
                    </div>
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
              <TableCell className={num}>
                {money(
                  toPesos(toCents(totals.absence_deduction) + toCents(totals.undertime_deduction)),
                )}
              </TableCell>
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
              {saved && (
                <Button asChild variant="outline">
                  <a href={pdfHref(open.employee_id)} target="_blank" rel="noopener">
                    <FileDownIcon aria-hidden />
                    Download payslip PDF
                  </a>
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
