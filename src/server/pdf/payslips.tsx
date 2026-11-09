import "server-only";

import { Document, Page, Text, View } from "@react-pdf/renderer";

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
          <Text style={s.small}>
            {formatAmountExact(slip.hourly_rate)} an hour · semi-monthly pay
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: 10,
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
            ["Short", formatMinutes(slip.undertime_minutes)],
            ["Overtime", formatMinutes(slip.overtime_minutes)],
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
          {[basicPayLine(slip), overtimeLine(slip)].map(
            (line) => line && <Line key={line.label} {...line} />,
          )}
          <Line label="Gross pay" value={formatAmountExact(slip.gross_pay)} strong />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>Deductions</Text>
          {[
            absencesLine(slip),
            undertimeLine(slip),
            contributionLine("SSS", slip.sss_deduction),
            contributionLine("PhilHealth", slip.philhealth_deduction),
            contributionLine("Pag-IBIG", slip.pagibig_deduction),
          ].map((line) => line && <Line key={line.label} {...line} />)}
          <Line {...totalDeductionsLine(slip)} strong />
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
