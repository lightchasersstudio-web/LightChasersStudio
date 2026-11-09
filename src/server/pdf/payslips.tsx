import "server-only";

import { Document, Page, Text, View } from "@react-pdf/renderer";

import { formatMinutes } from "@/lib/payroll/cutoff";
import { formatAmountExact } from "@/lib/payroll/money";
import type { Payslip } from "@/lib/payroll/payslip";
import { C, PdfFooter, PdfHeader, s, type Brand } from "@/server/pdf/kit";

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
    <View style={[s.row, s.rule]}>
      <View style={{ flex: 1 }}>
        <Text style={strong ? s.bold : undefined}>{label}</Text>
        {hint ? <Text style={s.small}>{hint}</Text> : null}
      </View>
      <Text style={[strong ? s.bold : {}, muted ? { color: C.muted } : {}]}>{value}</Text>
    </View>
  );
}

const deduction = (v: number | null) =>
  v === null ? { value: "Not enrolled", muted: true } : { value: `−${formatAmountExact(v)}` };

function PayslipPage({
  brand,
  slip,
  period,
  saved,
}: {
  brand: Brand;
  slip: Payslip;
  period: string;
  saved: string;
}) {
  const unpaid = slip.days_absent + slip.days_leave + slip.days_holiday;
  return (
    <Page size="A4" style={s.page}>
      <PdfHeader brand={brand} title="Payslip" subtitle={`Pay period: ${period}`} />

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
        <View>
          <Text style={s.small}>Employee</Text>
          <Text style={s.display}>{slip.employee_name}</Text>
          <Text style={{ color: C.muted }}>{slip.employee_position}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.small}>
            {slip.salary_type === "monthly" ? "Monthly salary" : "Daily rate"}
          </Text>
          <Text style={s.bold}>{formatAmountExact(slip.salary_rate)}</Text>
          <Text style={s.small}>Semi-monthly pay</Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          backgroundColor: C.ivory,
          borderRadius: 8,
          padding: 10,
          marginBottom: 16,
        }}
      >
        {(
          [
            ["Present", String(slip.days_present)],
            ["Absent", String(slip.days_absent)],
            ["Leave", String(slip.days_leave)],
            ["Holiday", String(slip.days_holiday)],
            ["Hours worked", formatMinutes(slip.minutes_worked)],
          ] as const
        ).map(([label, value]) => (
          <View key={label} style={{ flex: 1 }}>
            <Text style={s.small}>{label}</Text>
            <Text style={[s.bold, { fontSize: 12 }]}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: 24 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>Earnings</Text>
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
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>Deductions</Text>
          {slip.salary_type === "monthly" && (
            <Line
              label="Absences"
              hint={`${unpaid} unpaid ${unpaid === 1 ? "day" : "days"} × ${formatAmountExact(slip.daily_rate)}`}
              value={
                slip.absence_deduction ? `−${formatAmountExact(slip.absence_deduction)}` : "₱0.00"
              }
            />
          )}
          <Line label="SSS" {...deduction(slip.sss_deduction)} />
          <Line label="PhilHealth" {...deduction(slip.philhealth_deduction)} />
          <Line label="Pag-IBIG" {...deduction(slip.pagibig_deduction)} />
          <Line
            label="Total deductions"
            value={slip.total_deductions ? `−${formatAmountExact(slip.total_deductions)}` : "₱0.00"}
            strong
          />
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 20,
          padding: 14,
          borderRadius: 8,
          backgroundColor: slip.net_pay < 0 ? C.blush : C.sage,
        }}
      >
        <Text style={{ fontFamily: "Fraunces", fontSize: 14 }}>Net pay</Text>
        <Text style={{ fontFamily: "Fraunces", fontSize: 20 }}>
          {formatAmountExact(slip.net_pay)}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 40, marginTop: 56 }}>
        {["Prepared by", "Received by"].map((label) => (
          <View key={label} style={{ flex: 1 }}>
            <View style={{ borderBottomWidth: 0.75, borderBottomColor: C.ink, height: 24 }} />
            <Text style={[s.small, { marginTop: 4 }]}>
              {label}
              {label === "Received by" ? ` (${slip.employee_name})` : ""} · signature and date
            </Text>
          </View>
        ))}
      </View>

      <PdfFooter note={`Saved ${saved} · confidential`} />
    </Page>
  );
}

export function PayslipsDocument({
  brand,
  payslips,
  period,
  saved,
}: {
  brand: Brand;
  payslips: Payslip[];
  period: string;
  saved: string;
}) {
  return (
    <Document
      title={
        payslips.length === 1
          ? `Payslip – ${payslips[0]!.employee_name} – ${period}`
          : `Payslips – ${period}`
      }
      author={brand.name}
    >
      {payslips.map((p) => (
        <PayslipPage key={p.employee_id} brand={brand} slip={p} period={period} saved={saved} />
      ))}
    </Document>
  );
}
