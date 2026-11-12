import "server-only";

import { Document, Page, Text, View } from "@react-pdf/renderer";

import { dayStatusLabel } from "@/lib/payroll/cutoff";
import { endsNextDay, formatClock, type DailyPayroll } from "@/lib/payroll/daily-report";
import { categoryLabel } from "@/lib/payroll/employees";
import { formatAmountExact } from "@/lib/payroll/money";
import { C, PdfFooter, PdfHeader, s, type Brand } from "@/server/pdf/kit";

const COLS = [
  { label: "Employee", flex: 2.2 },
  { label: "Category", flex: 1.1 },
  { label: "Status", flex: 1 },
  { label: "Time in", flex: 0.9 },
  { label: "Time out", flex: 1.1 },
  { label: "Daily rate", flex: 1.1, right: true },
  { label: "Pay", flex: 1.1, right: true },
] as const;

const cell = (i: number) => ({
  flex: COLS[i]!.flex,
  textAlign: ("right" in COLS[i]! ? "right" : "left") as "right" | "left",
  paddingRight: 4,
});

/** The daily payroll on A4: totals, categories, a row per employee, the scope note. */
export function DailyPayrollDocument({
  brand,
  report,
  dayLabel,
  note,
}: {
  brand: Brand;
  report: DailyPayroll;
  dayLabel: string;
  note: string;
}) {
  const scope =
    report.filter === "all"
      ? "All staff"
      : categoryLabel(report.filter === "none" ? null : report.filter);
  return (
    <Document title={`Daily payroll ${report.date}`} author={brand.name}>
      <Page size="A4" style={s.page}>
        <PdfHeader brand={brand} title="Daily payroll" subtitle={`${dayLabel} · ${scope}`} />

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
          <View style={{ flex: 2, backgroundColor: C.sage, borderRadius: 8, padding: 12 }}>
            <Text style={s.small}>Total payroll</Text>
            <Text style={[s.display, { fontSize: 20 }]}>{formatAmountExact(report.total)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.ivory, borderRadius: 8, padding: 12 }}>
            <Text style={s.small}>Employees paid</Text>
            <Text style={[s.display, { fontSize: 20 }]}>{report.paidCount}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {report.subtotals.map((c) => (
            <View
              key={c.value}
              style={{
                flex: 1,
                borderWidth: 0.75,
                borderColor: C.line,
                borderRadius: 6,
                padding: 8,
              }}
            >
              <Text style={s.small}>{c.label}</Text>
              <Text style={s.bold}>{formatAmountExact(c.pay)}</Text>
              <Text style={s.small}>
                {c.people} {c.people === 1 ? "person" : "people"}
              </Text>
            </View>
          ))}
        </View>

        <View style={[s.row, s.rule, { paddingVertical: 4 }]} fixed>
          {COLS.map((c, i) => (
            <Text key={c.label} style={[s.small, cell(i)]}>
              {c.label}
            </Text>
          ))}
        </View>
        {report.rows.map((r) => (
          <View key={r.employeeId} style={[s.row, s.rule]} wrap={false}>
            <View style={cell(0)}>
              <Text style={s.bold}>{r.name}</Text>
              <Text style={s.small}>{r.position}</Text>
            </View>
            <Text style={cell(1)}>{categoryLabel(r.category)}</Text>
            <Text style={cell(2)}>{dayStatusLabel(r.status)}</Text>
            <Text style={cell(3)}>{formatClock(r.timeIn)}</Text>
            <View style={cell(4)}>
              <Text>{formatClock(r.timeOut)}</Text>
              {endsNextDay(r.timeIn, r.timeOut) ? <Text style={s.small}>next day</Text> : null}
              {r.timeOutEdited ? (
                <Text style={[s.small, { color: C.terracotta }]}>edited</Text>
              ) : null}
            </View>
            <Text style={cell(5)}>{formatAmountExact(r.dailyRate)}</Text>
            <Text style={[cell(6), s.bold]}>{formatAmountExact(r.pay)}</Text>
          </View>
        ))}
        <View style={[s.row, { paddingVertical: 6 }]} wrap={false}>
          <Text style={[s.bold, { flex: 1 }]}>Total</Text>
          <Text style={[s.bold, { textAlign: "right" }]}>{formatAmountExact(report.total)}</Text>
        </View>

        <Text style={[s.small, { marginTop: 10 }]}>{note}</Text>
        <PdfFooter note={`Daily payroll · ${dayLabel}`} />
      </Page>
    </Document>
  );
}
