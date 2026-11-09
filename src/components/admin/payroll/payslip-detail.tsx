import { formatMinutes } from "@/lib/payroll/cutoff";
import { formatAmountExact } from "@/lib/payroll/money";
import type { Payslip } from "@/lib/payroll/payslip";
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

const contribution = (v: number | null) =>
  v === null ? { value: "Not enrolled", muted: true } : { value: `−${formatAmountExact(v)}` };

/** The full breakdown of one payslip (dialog on the payroll page). */
export function PayslipDetail({ slip }: { slip: Payslip }) {
  const unpaid = slip.days_absent + slip.days_leave + slip.days_holiday;
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
          <dd className="text-muted-foreground">{formatMinutes(slip.minutes_worked)} worked</dd>
        </div>
      </dl>

      <section>
        <h3 className="mb-1 font-semibold">Earnings</h3>
        <dl className="divide-y">
          <Line
            label="Basic pay"
            hint={
              slip.salary_type === "monthly"
                ? `Half of ${formatAmountExact(slip.monthly_salary)} monthly`
                : `${slip.days_present} days × ${formatAmountExact(slip.daily_rate)}`
            }
            value={formatAmountExact(slip.basic_pay)}
          />
          <Line label="Gross pay" value={formatAmountExact(slip.gross_pay)} strong />
        </dl>
      </section>

      <section>
        <h3 className="mb-1 font-semibold">Deductions</h3>
        <dl className="divide-y">
          {slip.salary_type === "monthly" && (
            <Line
              label="Absences"
              hint={`${unpaid} unpaid ${unpaid === 1 ? "day" : "days"} × ${formatAmountExact(slip.daily_rate)}`}
              value={
                slip.absence_deduction ? `−${formatAmountExact(slip.absence_deduction)}` : "₱0.00"
              }
            />
          )}
          <Line label="SSS" {...contribution(slip.sss_deduction)} />
          <Line label="PhilHealth" {...contribution(slip.philhealth_deduction)} />
          <Line label="Pag-IBIG" {...contribution(slip.pagibig_deduction)} />
          <Line
            label="Total deductions"
            value={slip.total_deductions ? `−${formatAmountExact(slip.total_deductions)}` : "₱0.00"}
            strong
          />
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
