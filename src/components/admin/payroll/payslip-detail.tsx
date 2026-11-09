import { formatMinutes } from "@/lib/payroll/cutoff";
import { formatAmountExact } from "@/lib/payroll/money";
import type { Payslip } from "@/lib/payroll/payslip";
import {
  absencesLine,
  basicPayLine,
  contributionLine,
  overtimeLine,
  totalDeductionsLine,
  undertimeLine,
} from "@/lib/payroll/payslip-lines";
import { cn } from "@/lib/utils";

function Line({
  label,
  hint,
  value,
  strong,
  muted,
}: {
  label: string;
  hint?: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn("flex items-baseline justify-between gap-4 py-1.5", strong && "font-semibold")}
    >
      <dt>
        {label}
        {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
      </dt>
      <dd className={cn("tabular-nums", muted && "text-muted-foreground")}>{value}</dd>
    </div>
  );
}

/** The full breakdown of one payslip (dialog on the payroll page). */
export function PayslipDetail({ slip }: { slip: Payslip }) {
  const time = [
    `${formatMinutes(slip.minutes_worked)} worked`,
    slip.undertime_minutes ? `${formatMinutes(slip.undertime_minutes)} short` : null,
    slip.overtime_minutes ? `${formatMinutes(slip.overtime_minutes)} overtime` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/60 p-4 sm:grid-cols-4">
        {(
          [
            ["Present", slip.days_present],
            ["Absent", slip.days_absent],
            ["Leave", slip.days_leave],
            ["Holiday", slip.days_holiday],
          ] as const
        ).map(([label, n]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{n}</dd>
          </div>
        ))}
        <div className="col-span-2 sm:col-span-4">
          <dt className="sr-only">Hours worked</dt>
          <dd className="text-muted-foreground">{time}</dd>
        </div>
      </dl>

      <section>
        <h3 className="mb-1 font-semibold">Earnings</h3>
        <dl className="divide-y">
          {[basicPayLine(slip), overtimeLine(slip)].map(
            (line) => line && <Line key={line.label} {...line} />,
          )}
          <Line label="Gross pay" value={formatAmountExact(slip.gross_pay)} strong />
        </dl>
      </section>

      <section>
        <h3 className="mb-1 font-semibold">Deductions</h3>
        <dl className="divide-y">
          {[
            absencesLine(slip),
            undertimeLine(slip),
            contributionLine("SSS", slip.sss_deduction),
            contributionLine("PhilHealth", slip.philhealth_deduction),
            contributionLine("Pag-IBIG", slip.pagibig_deduction),
          ].map((line) => line && <Line key={line.label} {...line} />)}
          <Line {...totalDeductionsLine(slip)} strong />
        </dl>
      </section>

      <div
        className={cn(
          "flex items-baseline justify-between rounded-2xl p-4",
          slip.net_pay < 0 ? "bg-destructive/10 text-destructive" : "bg-sage/20",
        )}
      >
        <span className="font-heading text-lg font-semibold">Net pay</span>
        <span className="font-heading text-2xl font-semibold tabular-nums">
          {formatAmountExact(slip.net_pay)}
        </span>
      </div>
      {slip.net_pay < 0 && (
        <p className="text-sm text-muted-foreground">
          The contributions are more than the pay for this cut-off. Check the time record, or switch
          off contributions you won&apos;t deduct this time.
        </p>
      )}
    </div>
  );
}
