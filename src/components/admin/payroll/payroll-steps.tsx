import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { cutoffLabel, type Cutoff } from "@/lib/payroll/cutoff";
import { nextStep, stepDone, type PayrollFlow, type PayrollStepId } from "@/lib/payroll/flow";
import { cn } from "@/lib/utils";
import { BUSINESS_TZ } from "@/lib/utils/business-date";

const day = (iso: string) => format(new TZDate(iso, BUSINESS_TZ), "d MMM, h:mm a");

/**
 * "1 Record days → 2 Save the payroll → 3 Print payslips" for one cut-off, at
 * the top of the Time record and Payroll pages: where it stands and what's next.
 */
export function PayrollSteps({
  cutoff,
  flow,
  page,
}: {
  cutoff: Cutoff;
  flow: PayrollFlow;
  page: "record" | "payroll";
}) {
  const next = nextStep(flow);
  const saved = flow.savedAt !== null;
  const steps: {
    id: PayrollStepId;
    title: string;
    /** Phones: the three steps sit in one row, so short titles. */
    short: string;
    detail: string;
    href: string | null;
    external?: boolean;
    warn?: boolean;
  }[] = [
    {
      id: "record",
      title: "Record days",
      short: "Record days",
      detail:
        flow.staff === 0
          ? "Add staff under Employees first"
          : `${flow.staffComplete} of ${flow.staff} staff have every day filled in`,
      href: `/admin/dtr?cutoff=${cutoff.start}`,
    },
    {
      id: "payroll",
      title: "Check & save the payroll",
      short: "Save payroll",
      detail: !saved
        ? "Not saved yet"
        : flow.changed
          ? `Days or pay changed since saving (${day(flow.savedAt!)}). Save again.`
          : `Saved ${day(flow.savedAt!)}`,
      href: `/admin/payroll?cutoff=${cutoff.start}`,
      warn: flow.changed,
    },
    {
      id: "payslips",
      title: "Print payslips",
      short: "Payslips",
      detail: saved ? "All payslips as one PDF" : "Ready once the payroll is saved",
      href: saved ? `/admin/payroll/pdf?cutoff=${cutoff.start}` : null,
      external: true,
    },
  ];

  return (
    <nav aria-label={`Payroll steps for ${cutoffLabel(cutoff)}`}>
      <ol className="grid grid-cols-3 gap-2">
        {steps.map((step, i) => {
          const done = stepDone(flow, step.id);
          const here = step.id === page;
          const isNext = step.id === next && !done;
          const body = (
            <>
              <span
                aria-hidden
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  step.warn && "border-terracotta bg-blush text-terracotta-ink",
                  !done && !step.warn && isNext && "border-primary text-primary",
                )}
              >
                {done ? (
                  <CheckIcon className="size-4" />
                ) : step.warn ? (
                  <TriangleAlertIcon className="size-4" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-semibold md:justify-start md:text-base">
                  <span>
                    <span className="sr-only">Step {i + 1}: </span>
                    <span className="md:hidden">{step.short}</span>
                    <span className="max-md:hidden">{step.title}</span>
                  </span>
                  {isNext && (
                    <span className="rounded-full bg-terracotta-ink px-2 py-0.5 text-xs font-semibold text-white">
                      Next
                    </span>
                  )}
                  {done && <span className="sr-only">(done)</span>}
                </span>
                <span
                  className={cn(
                    "block text-sm max-md:sr-only",
                    step.warn ? "text-terracotta-ink" : "text-muted-foreground",
                  )}
                >
                  {step.detail}
                </span>
              </span>
            </>
          );
          const box = cn(
            "flex h-full flex-col items-center gap-1.5 rounded-2xl border bg-card p-2 text-center md:flex-row md:items-start md:gap-3 md:p-3 md:text-left",
            here && "border-primary ring-2 ring-primary/20",
          );
          const linkBox = cn(
            box,
            "transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          );
          return (
            <li key={step.id}>
              {step.href && !here && step.external ? (
                // A route handler (the PDF): a plain link opens it in a new tab.
                <a href={step.href} target="_blank" rel="noopener" className={linkBox}>
                  {body}
                </a>
              ) : step.href && !here ? (
                <Link href={step.href} className={linkBox}>
                  {body}
                </Link>
              ) : (
                <div
                  className={cn(box, !step.href && "opacity-70")}
                  aria-current={here ? "step" : undefined}
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
