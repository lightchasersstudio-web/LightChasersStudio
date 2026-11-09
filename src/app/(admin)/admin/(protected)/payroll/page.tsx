import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import {
  CircleCheckIcon,
  FileDownIcon,
  InfoIcon,
  PercentIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyList } from "@/components/admin/lists/pager";
import { PageHeader } from "@/components/admin/page-header";
import { CutoffPicker } from "@/components/admin/payroll/cutoff-picker";
import { PayrollTable } from "@/components/admin/payroll/payroll-table";
import { SavePayrollButton } from "@/components/admin/payroll/save-payroll-button";
import { ListSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { currentCutoff, cutoffLabel, parseCutoff, type Cutoff } from "@/lib/payroll/cutoff";
import { formatAmountExact } from "@/lib/payroll/money";
import { payrollTotals, payslipFingerprint, type Payslip } from "@/lib/payroll/payslip";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { requireAdmin } from "@/server/auth";
import { computePayroll, getSavedPayroll, listSavedPayrolls } from "@/server/queries/payroll";

export const metadata: Metadata = { title: "Payroll" };

export default function PayrollPage({ searchParams }: PageProps<"/admin/payroll">) {
  return (
    <>
      <PageHeader
        eyebrow="pay day"
        title="Payroll"
        description="Pick a cut-off to work out everyone's payslip from the time record, salaries and benefits. Review it, then save."
        actions={
          <Button asChild variant="outline" size="lg">
            <Link href="/admin/payroll/settings">
              <PercentIcon aria-hidden />
              Contribution rates
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <Payroll searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const when = (iso: string) => format(new TZDate(iso, BUSINESS_TZ), "d MMM yyyy, h:mm a");

async function Payroll({ searchParams }: Pick<PageProps<"/admin/payroll">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const current = currentCutoff();
  const cutoff = parseCutoff(params.cutoff) ?? current;
  const wantPreview = params.view === "preview";

  const [fresh, saved, recent] = await Promise.all([
    computePayroll(cutoff),
    getSavedPayroll(cutoff),
    listSavedPayrolls(),
  ]);

  // Has anything changed since saving (time record, salaries, benefits, rates, staff)?
  const changed =
    saved !== null &&
    [...fresh.map(payslipFingerprint)].sort().join("\n") !==
      [...saved.payslips.map(payslipFingerprint)].sort().join("\n");
  const showing: Payslip[] = saved && !wantPreview ? saved.payslips : fresh;
  const label = cutoffLabel(cutoff);
  const href = (start: string) => `/admin/payroll?cutoff=${start}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CutoffPicker cutoff={cutoff} current={current} href={href} />
        <div className="flex flex-wrap gap-2">
          {saved && !wantPreview && (
            <Button asChild variant="outline" size="lg">
              {/* A route handler: a plain link opens the PDF in a new tab. */}
              <a href={`/admin/payroll/pdf?cutoff=${cutoff.start}`} target="_blank" rel="noopener">
                <FileDownIcon aria-hidden />
                All payslips (PDF)
              </a>
            </Button>
          )}
          {fresh.length > 0 && (!saved || changed || wantPreview) && (
            <SavePayrollButton
              cutoff={cutoff.start}
              cutoffLabel={label}
              replaces={saved !== null}
              count={fresh.length}
            />
          )}
        </div>
      </div>

      <Status cutoff={cutoff} saved={saved} changed={changed} preview={wantPreview} />

      {showing.length === 0 ? (
        <EmptyList
          title="No one to pay yet"
          text="Add active employees under Employees, then come back to make their payslips."
        />
      ) : (
        <>
          <Totals payslips={showing} />
          <PayrollTable
            // key: a fresh dialog state when switching cut-off or view
            key={`${cutoff.start}-${saved && !wantPreview ? "saved" : "preview"}`}
            payslips={showing}
            cutoffLabel={label}
            cutoffStart={cutoff.start}
            saved={saved !== null && !wantPreview}
          />
        </>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent-payrolls" className="pt-4">
          <h2 id="recent-payrolls" className="mb-3 text-xl font-semibold">
            Saved payrolls
          </h2>
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {recent.map((r) => {
              const c = parseCutoff(r.start);
              return (
                <li key={r.start}>
                  <Link
                    href={href(r.start)}
                    aria-current={r.start === cutoff.start ? "page" : undefined}
                    className="grid grid-cols-[1fr_auto] gap-x-4 px-5 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:bg-muted/70"
                  >
                    <span className="font-semibold">{c ? cutoffLabel(c) : r.start}</span>
                    <span className="text-right font-semibold tabular-nums">
                      {formatAmountExact(r.net)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {r.count} payslips · saved {when(r.savedAt)}
                    </span>
                    <span className="text-right text-sm text-muted-foreground">net pay</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Status({
  cutoff,
  saved,
  changed,
  preview,
}: {
  cutoff: Cutoff;
  saved: Awaited<ReturnType<typeof getSavedPayroll>>;
  changed: boolean;
  preview: boolean;
}) {
  const box = "flex flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl border p-4 text-sm";
  if (!saved) {
    return (
      <p className={`${box} bg-card`}>
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span className="flex-1">
          <strong>Preview, not saved yet.</strong> These payslips use today&apos;s time record,
          salaries and benefits. Check the time record is complete, then save.
        </span>
      </p>
    );
  }
  const by = saved.savedBy ? ` by ${saved.savedBy}` : "";
  if (!changed) {
    return (
      <p className={`${box} border-sage bg-sage/15`}>
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span className="flex-1">
          <strong>Saved</strong> {when(saved.savedAt)}
          {by}. Nothing has changed since.
        </span>
      </p>
    );
  }
  return (
    <div className={`${box} border-terracotta/40 bg-blush/40`}>
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
      <p className="flex-1">
        <strong>
          Saved {when(saved.savedAt)}
          {by}, but things have changed since
        </strong>{" "}
        (time record, salaries, benefits, rates or staff).{" "}
        {preview
          ? "You're looking at the new figures. Save again to replace the saved payslips."
          : "You're looking at the saved payslips."}
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/payroll?cutoff=${cutoff.start}${preview ? "" : "&view=preview"}`}>
          {preview ? "Show saved payslips" : "Show new figures"}
        </Link>
      </Button>
    </div>
  );
}

function Totals({ payslips }: { payslips: Payslip[] }) {
  const t = payrollTotals(payslips);
  const tiles = [
    { label: "Employees", value: String(payslips.length) },
    { label: "Gross pay", value: formatAmountExact(t.gross_pay) },
    { label: "Deductions", value: formatAmountExact(t.total_deductions) },
    { label: "Net pay", value: formatAmountExact(t.net_pay), strong: true },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={
            tile.strong
              ? "rounded-3xl bg-primary p-4 text-primary-foreground"
              : "rounded-3xl border bg-card p-4"
          }
        >
          <dt className={tile.strong ? "text-sm opacity-90" : "text-sm text-muted-foreground"}>
            {tile.label}
          </dt>
          <dd className="mt-1 font-heading text-2xl font-semibold tabular-nums">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
