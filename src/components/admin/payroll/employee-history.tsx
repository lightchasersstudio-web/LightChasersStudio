import { format, parseISO } from "date-fns";
import { FileDownIcon, PencilIcon } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  cutoffFor,
  cutoffLabel,
  dayStatusLabel,
  formatMinutes,
  hasTimes,
} from "@/lib/payroll/cutoff";
import { endsNextDay, formatClock } from "@/lib/payroll/daily-report";
import { formatAmountExact } from "@/lib/payroll/money";
import { cn } from "@/lib/utils";
import type { EmployeeHistory as History } from "@/server/queries/employee-history";

const link = "font-semibold text-primary underline-offset-4 hover:underline";

/** Payments (saved payslips) and shifts (time record) for one employee. */
export function EmployeeHistory({
  employeeId,
  history,
  deleted,
}: {
  employeeId: string;
  history: History;
  /** Deleted staff aren't in the time record, so no links to it. */
  deleted: boolean;
}) {
  const { payments, shifts, shiftCount, totalNet } = history;
  return (
    <section aria-labelledby="history-title" className="mt-6 space-y-6">
      <h2 id="history-title" className="text-2xl font-semibold">
        History
      </h2>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>
            {payments.length
              ? `${payments.length} saved ${payments.length === 1 ? "payslip" : "payslips"}, ${formatAmountExact(totalNet)} net in all.`
              : "No saved payslips yet. They show here once a payroll with this employee is saved."}
          </CardDescription>
        </CardHeader>
        {payments.length > 0 && (
          <CardContent>
            <div className="overflow-hidden rounded-2xl border">
              <Table className="min-w-[38rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Cut-off</TableHead>
                    <TableHead className="text-right">Days worked</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net pay</TableHead>
                    <TableHead className="pr-4">
                      <span className="sr-only">Payslip</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const cutoff = cutoffFor(p.periodStart);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="pl-4">
                          <span className="font-semibold">{cutoffLabel(cutoff)}</span>
                          <span className="block text-xs text-muted-foreground">
                            Saved {format(parseISO(p.savedAt), "d MMM yyyy")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.daysWorked}
                          {p.daysOff > 0 && (
                            <span className="block text-xs text-muted-foreground">
                              {p.daysOff} off
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAmountExact(p.gross)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatAmountExact(p.deductions)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatAmountExact(p.net)}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <a
                            href={`/admin/payroll/pdf?cutoff=${cutoff.start}&employee=${employeeId}`}
                            target="_blank"
                            rel="noopener"
                            className={cn(link, "inline-flex items-center gap-1 text-sm")}
                          >
                            <FileDownIcon className="size-4" aria-hidden />
                            Payslip
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shifts</CardTitle>
          <CardDescription>
            {shifts.length === 0
              ? "Nothing in the time record yet."
              : shiftCount > shifts.length
                ? `The latest ${shifts.length} of ${shiftCount} recorded days. Pay is gross, at the rate saved with each day.`
                : `${shiftCount} recorded ${shiftCount === 1 ? "day" : "days"}. Pay is gross, at the rate saved with each day.`}
          </CardDescription>
        </CardHeader>
        {shifts.length > 0 && (
          <CardContent>
            <div className="overflow-hidden rounded-2xl border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Day</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time in</TableHead>
                    <TableHead>Time out</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Daily rate</TableHead>
                    <TableHead className="pr-4 text-right">Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((s) => (
                    <TableRow key={s.date} className={cn(s.pay === 0 && "text-muted-foreground")}>
                      <TableCell className="pl-4">
                        {deleted ? (
                          <span className="font-semibold text-foreground">
                            {format(parseISO(s.date), "EEE d MMM yyyy")}
                          </span>
                        ) : (
                          <Link
                            href={`/admin/dtr?cutoff=${cutoffFor(s.date).start}&employee=${employeeId}`}
                            className={link}
                          >
                            {format(parseISO(s.date), "EEE d MMM yyyy")}
                          </Link>
                        )}
                        {s.note && (
                          <span className="block max-w-48 truncate text-xs text-muted-foreground">
                            {s.note}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{dayStatusLabel(s.status)}</TableCell>
                      <TableCell className="tabular-nums">{formatClock(s.timeIn)}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatClock(s.timeOut)}
                        {endsNextDay(s.timeIn, s.timeOut) && (
                          <span className="block text-xs text-muted-foreground">next day</span>
                        )}
                        {s.timeOutEdited && (
                          <span className="flex items-center gap-1 text-xs text-terracotta-ink">
                            <PencilIcon className="size-3" aria-hidden />
                            edited
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {hasTimes(s.status) ? formatMinutes(s.minutes) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAmountExact(s.dailyRate)}
                      </TableCell>
                      <TableCell className="pr-4 text-right font-semibold text-foreground tabular-nums">
                        {formatAmountExact(s.pay)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    </section>
  );
}
