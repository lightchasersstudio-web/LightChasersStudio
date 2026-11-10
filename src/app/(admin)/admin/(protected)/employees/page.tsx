import { format } from "date-fns";
import {
  ArrowRightIcon,
  FileDownIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyList } from "@/components/admin/lists/pager";
import { PageHeader } from "@/components/admin/page-header";
import { EmployeeAvatar } from "@/components/admin/payroll/employee-avatar";
import { EmployeeCategoryBadge } from "@/components/admin/payroll/employee-category-badge";
import { ListSkeleton } from "@/components/admin/skeletons";
import { Button } from "@/components/ui/button";
import {
  asSalaryType,
  EMPLOYEE_CATEGORIES,
  isEmployeeCategory,
  UNCATEGORIZED,
} from "@/lib/payroll/employees";
import { formatAmount } from "@/lib/payroll/money";
import { cn } from "@/lib/utils";
import { tzDate } from "@/lib/utils/business-date";
import { requireAdmin } from "@/server/auth";
import {
  countEmployees,
  listEmployees,
  type EmployeeCategoryFilter,
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
                <SlidersHorizontalIcon aria-hidden />
                Payroll settings
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
  const { status: raw, category: rawCategory } = await searchParams;
  const status: EmployeeStatusFilter =
    raw === "inactive" ? "inactive" : raw === "deleted" ? "deleted" : "active";
  const category: EmployeeCategoryFilter = isEmployeeCategory(rawCategory)
    ? rawCategory
    : rawCategory === "none"
      ? "none"
      : null;
  const [employees, counts] = await Promise.all([
    listEmployees(status, category),
    countEmployees(),
  ]);
  const href = (s: EmployeeStatusFilter, c: EmployeeCategoryFilter) => {
    const q = new URLSearchParams();
    if (s !== "active") q.set("status", s);
    if (c) q.set("category", c);
    return q.size ? `/admin/employees?${q}` : "/admin/employees";
  };
  const categoryFilters: { value: EmployeeCategoryFilter; label: string }[] = [
    { value: null, label: "All" },
    ...EMPLOYEE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
    ...(counts.uncategorized > 0 || category === "none"
      ? [{ value: "none" as const, label: UNCATEGORIZED }]
      : []),
  ];

  return (
    <>
      {counts.uncategorized > 0 && (
        <p className="mb-5 flex gap-2 rounded-2xl border border-terracotta/40 bg-blush/40 p-4 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-terracotta-ink" aria-hidden />
          <span>
            {counts.uncategorized === 1
              ? "1 employee has no category yet."
              : `${counts.uncategorized} employees have no category yet.`}{" "}
            Open each one and pick Events, Photobooth or Studio so the daily payroll groups them
            correctly.{" "}
            {category !== "none" && (
              <Link
                href={href("active", "none")}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Show them
              </Link>
            )}
          </span>
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <nav aria-label="Filter employees" className="flex gap-2">
          {(
            [
              "active",
              "inactive",
              ...(counts.deleted || status === "deleted" ? (["deleted"] as const) : []),
            ] satisfies EmployeeStatusFilter[]
          ).map((s) => (
            <Link
              key={s}
              href={href(s, category)}
              aria-current={status === s ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                status === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted",
              )}
            >
              {s === "active" ? "Active" : s === "inactive" ? "Inactive" : "Deleted"}
              <span className="tabular-nums opacity-80">{counts[s]}</span>
            </Link>
          ))}
        </nav>
        <nav
          aria-label="Filter by category"
          className="-mx-4 flex w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:px-0"
        >
          {categoryFilters.map((c) => (
            <Link
              key={c.value ?? "all"}
              href={href(status, c.value)}
              aria-current={category === c.value ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                category === c.value
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {c.label}
            </Link>
          ))}
        </nav>
        {employees.length > 0 && status !== "deleted" && (
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
          title={
            category
              ? "No one here"
              : status === "active"
                ? "No employees yet"
                : status === "deleted"
                  ? "No deleted employees"
                  : "No inactive employees"
          }
          text={
            category
              ? "No employees in this category. Pick another one above."
              : status === "active"
                ? "Add your team to start keeping time records and making payslips."
                : status === "deleted"
                  ? "Employees you delete are kept here with their payments and shifts."
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
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold break-words">{e.full_name}</span>
                      <EmployeeCategoryBadge category={e.category} />
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {e.position}
                    </span>
                  </span>
                  <span className="hidden text-sm text-muted-foreground sm:block">
                    {e.deleted_at
                      ? `Deleted ${format(new Date(e.deleted_at), "d MMM yyyy")}`
                      : `Since ${format(tzDate(e.date_hired), "d MMM yyyy")}`}
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
