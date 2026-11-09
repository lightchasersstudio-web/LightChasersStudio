import "server-only";

import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";

import { BENEFITS, monthlyContributions, cutoffShare } from "@/lib/payroll/contributions";
import type { ContributionRates } from "@/lib/payroll/contributions";
import { asSalaryType, formatGovId, GOV_IDS, salaryRates } from "@/lib/payroll/employees";
import { formatAmountExact } from "@/lib/payroll/money";
import type { EmployeeDetail } from "@/server/queries/employees";
import { C, PdfFooter, PdfHeader, s, type Brand } from "@/server/pdf/kit";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={{ width: "50%", paddingRight: 12, marginBottom: 8 }}>
      <Text style={s.small}>{label}</Text>
      <Text>{value || "—"}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }} wrap={false}>
      <Text style={s.h2}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{children}</View>
    </View>
  );
}

function EmployeePage({
  brand,
  employee: e,
  photo,
  rates,
  printed,
}: {
  brand: Brand;
  employee: EmployeeDetail;
  photo: Buffer | undefined;
  rates: ContributionRates;
  printed: string;
}) {
  const type = asSalaryType(e.salary_type);
  const { monthly, daily } = salaryRates(type, Number(e.salary_rate), rates.workDaysPerMonth);
  const shares = monthlyContributions(monthly, rates);
  const enabled = {
    sss: e.benefits?.sss_enabled ?? true,
    philhealth: e.benefits?.philhealth_enabled ?? true,
    pagibig: e.benefits?.pagibig_enabled ?? true,
  };

  return (
    <Page size="A4" style={s.page}>
      <PdfHeader brand={brand} title="Employee details" subtitle={printed} />

      <View style={{ flexDirection: "row", gap: 16, alignItems: "center", marginBottom: 18 }}>
        {photo ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an <img>
          <Image
            src={photo}
            style={{ width: 72, height: 72, borderRadius: 36, objectFit: "cover" }}
          />
        ) : (
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: C.blush,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: "Fraunces", fontSize: 22, color: C.terracotta }}>
              {e.full_name
                .split(/\s+/)
                .filter(Boolean)
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </Text>
          </View>
        )}
        <View>
          <Text style={[s.display, { fontSize: 18 }]}>{e.full_name}</Text>
          <Text style={{ color: C.muted }}>
            {e.position} · {e.is_active ? "Active" : "Inactive"}
          </Text>
        </View>
      </View>

      <Section title="Employment">
        <Field label="Position" value={e.position} />
        <Field label="Date hired" value={format(parseISO(e.date_hired), "d MMMM yyyy")} />
        <Field label="Status" value={e.is_active ? "Active" : "Inactive"} />
      </Section>

      <Section title="Contact">
        <Field label="Contact no." value={e.phone} />
        <Field label="Email" value={e.email} />
        <View style={{ width: "100%", marginBottom: 8 }}>
          <Text style={s.small}>Address</Text>
          <Text>{e.address || "—"}</Text>
        </View>
      </Section>

      <Section title="Government numbers">
        <Field label={GOV_IDS.sss.label} value={formatGovId("sss", e.sss_no)} />
        <Field
          label={GOV_IDS.philhealth.label}
          value={formatGovId("philhealth", e.philhealth_no)}
        />
        <Field label={GOV_IDS.pagibig.label} value={formatGovId("pagibig", e.pagibig_no)} />
      </Section>

      <Section title="Salary">
        <Field
          label={type === "monthly" ? "Monthly salary" : "Daily rate"}
          value={formatAmountExact(Number(e.salary_rate))}
        />
        <Field label="Pay schedule" value="Semi-monthly (1st–15th, 16th–end of month)" />
        {type === "monthly" ? (
          <>
            <Field label="Per cut-off" value={formatAmountExact(cutoffShare(monthly, 1))} />
            <Field
              label={`Daily rate (÷ ${rates.workDaysPerMonth} days)`}
              value={formatAmountExact(daily)}
            />
          </>
        ) : (
          <Field
            label={`Monthly, for contributions (× ${rates.workDaysPerMonth} days)`}
            value={formatAmountExact(monthly)}
          />
        )}
      </Section>

      <View wrap={false}>
        <Text style={s.h2}>Benefits (employee share)</Text>
        <View style={[s.row, s.rule, { paddingVertical: 4 }]}>
          <Text style={[s.small, { flex: 1 }]}>Contribution</Text>
          <Text style={[s.small, { width: 90, textAlign: "right" }]}>Per month</Text>
          <Text style={[s.small, { width: 90, textAlign: "right" }]}>Per cut-off</Text>
        </View>
        {BENEFITS.map(({ key, label }) => (
          <View key={key} style={[s.row, s.rule]}>
            <Text style={{ flex: 1 }}>{label}</Text>
            {enabled[key] ? (
              <>
                <Text style={{ width: 90, textAlign: "right" }}>
                  {formatAmountExact(shares[key].monthly)}
                </Text>
                <Text style={{ width: 90, textAlign: "right" }}>
                  {formatAmountExact(cutoffShare(shares[key].monthly, 1))}
                </Text>
              </>
            ) : (
              <Text style={{ width: 180, textAlign: "right", color: C.muted }}>Not enrolled</Text>
            )}
          </View>
        ))}
      </View>

      <PdfFooter
        note={`Confidential: personal data under the Data Privacy Act of 2012 (RA 10173).`}
      />
    </Page>
  );
}

export function EmployeeDetailsDocument({
  brand,
  employees,
  photos,
  rates,
  printed,
}: {
  brand: Brand;
  employees: EmployeeDetail[];
  photos: Map<string, Buffer>;
  rates: ContributionRates;
  printed: string;
}) {
  return (
    <Document
      title={employees.length === 1 ? `${employees[0]!.full_name} – details` : "Staff details"}
      author={brand.name}
    >
      {employees.map((e) => (
        <EmployeePage
          key={e.id}
          brand={brand}
          employee={e}
          photo={e.photo_path ? photos.get(e.photo_path) : undefined}
          rates={rates}
          printed={printed}
        />
      ))}
    </Document>
  );
}
