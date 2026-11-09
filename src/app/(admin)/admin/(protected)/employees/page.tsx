import { format } from "date-fns";
import { ArrowRightIcon, FileDownIcon, PercentIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyList } from "@/components/admin/lists/pager";
import { PageHeader } from "@/components/admin/page-header";
import { EmployeeAvatar } from "@/components/admin/payroll/employee-avatar";
import { ListSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import { asSalaryType } from "@/lib/payroll/employees";
import { formatAmount } from "@/lib/payroll/money";
import { cn } from "@/lib/utils";
import { tzDate } from "@/lib/utils/business-date";
import { requireAdmin } from "@/server/auth";
import {
  countEmployees,
  listEmployees,
  type EmployeeStatusFilter,
} from "@/server/queries/employees";

export const metadata: Metadata = { title: "Employees" };

export default function EmployeesPage({ searchParams }: PageProps<"/admin/employees">) {
  return (
    <>
      <PageHeader
        eyebrow="the team"
        title="Employees"
        description="Staff details, salary and government numbers for payroll."
        actions={
          <>
            <Button asChild size="lg" variant="outline">
              <Link href="/admin/payroll/settings">
                <PercentIcon aria-hidden />
                Contribution rates
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/admin/employees/new">
                <PlusIcon aria-hidden />
                Add employee
              </Link>
            </Button>
          </>
        }
      />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Employees searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Employees({ searchParams }: Pick<PageProps<"/admin/employees">, "searchParams">) {
  await requireAdmin();
  const { status: raw } = await searchParams;
  const status: EmployeeStatusFilter = raw === "inactive" ? "inactive" : "active";
  const [employees, counts] = await Promise.all([listEmployees(status), countEmployees()]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <nav aria-label="Filter employees" className="flex gap-2">
          {(["active", "inactive"] as const).map((s) => (
            <Link
              key={s}
              href={s === "active" ? "/admin/employees" : "/admin/employees?status=inactive"}
              aria-current={status === s ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                status === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted",
              )}
            >
              {s === "active" ? "Active" : "Inactive"}
              <span className="tabular-nums opacity-80">{counts[s]}</span>
            </Link>
          ))}
        </nav>
        {employees.length > 0 && (
          <Button asChild variant="outline" className="sm:ml-auto">
            {/* A route handler, not a page: a plain link that opens the PDF in a new tab. */}
            <a
              href={`/admin/employees/pdf${status === "inactive" ? "?status=inactive" : ""}`}
              target="_blank"
              rel="noopener"
            >
              <FileDownIcon aria-hidden />
              All {status} staff (PDF)
            </a>
          </Button>
        )}
      </div>

      {employees.length === 0 ? (
        <EmptyList
          title={status === "active" ? "No employees yet" : "No inactive employees"}
          text={
            status === "active"
              ? "Add your team to start keeping time records and making payslips."
              : "Employees you deactivate are kept here."
          }
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
          {employees.map((e) => {
            const type = asSalaryType(e.salary_type);
            return (
              <li key={e.id}>
                <Link
                  href={`/admin/employees/${e.id}`}
                  className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-4 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:grid-cols-[auto_1fr_10rem_9rem_1rem] sm:px-5"
                >
                  <EmployeeAvatar name={e.full_name} photoUrl={e.photoUrl} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{e.full_name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {e.position}
                    </span>
                  </span>
                  <span className="hidden text-sm text-muted-foreground sm:block">
                    Since {format(tzDate(e.date_hired), "d MMM yyyy")}
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums">
                    {formatAmount(Number(e.salary_rate))}
                    <span className="block font-normal text-muted-foreground">
                      {type === "monthly" ? "a month" : "a day"}
                    </span>
                  </span>
                  <ArrowRightIcon
                    className="hidden size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
