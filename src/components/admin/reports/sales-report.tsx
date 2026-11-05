"use client";

import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CalendarCheckIcon,
  CrownIcon,
  ReceiptIcon,
  TableIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PACKAGE_CATEGORIES, type ServiceCategory } from "@/lib/catalog";
import { PAYMENT_METHODS, type PaymentMethod, type SalesMonth } from "@/lib/reports/sales";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/utils/money";
import { ATTENDEE_CATEGORIES } from "@/lib/validations/booking";

const RANGES = [
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
] as const;

const METHOD_COLORS: Record<PaymentMethod, string> = {
  online: "bg-viz-1",
  gcash: "bg-viz-2",
  cash: "bg-viz-3",
};

/** ₱1.2M / ₱120K / ₱950 */
function pesoCompact(cents: number): string {
  const pesos = cents / 100;
  if (pesos >= 1_000_000) return `₱${(pesos / 1_000_000).toFixed(pesos >= 10_000_000 ? 0 : 1)}M`;
  if (pesos >= 1_000) return `₱${Math.round(pesos / 1_000)}K`;
  return `₱${Math.round(pesos)}`;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function totals(months: SalesMonth[]) {
  const sales = sum(months.map((m) => m.salesCents));
  const bookings = sum(months.map((m) => m.bookings));
  return { sales, bookings, average: bookings ? Math.round(sales / bookings / 100) * 100 : 0 };
}

/** `all`: the last 24 months up to this one, oldest first (see getSalesMonths). */
export function SalesReport({ months: all }: { months: SalesMonth[] }) {
  const [range, setRange] = useState<number>(6);
  const [showTable, setShowTable] = useState(false);

  const current = all.slice(-range);
  const previous = all.slice(-range * 2, -range);
  const now = totals(current);
  const before = totals(previous);

  const byCategory = PACKAGE_CATEGORIES.map((c) => ({
    ...c,
    salesCents: sum(current.map((m) => m.byCategory[c.value]?.salesCents ?? 0)),
    bookings: sum(current.map((m) => m.byCategory[c.value]?.bookings ?? 0)),
  }))
    .filter((c) => c.salesCents > 0)
    .sort((a, b) => b.salesCents - a.salesCents);
  const top = byCategory[0];

  const byMethod = PAYMENT_METHODS.map((m) => ({
    ...m,
    cents: sum(current.map((x) => x.byMethod[m.value])),
  }));
  const received = sum(byMethod.map((m) => m.cents));

  return (
    <div className="space-y-6">
      {/* Filters: one row above everything they scope. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="radiogroup"
          aria-label="Report period"
          className="inline-flex rounded-full border bg-card p-1"
        >
          {RANGES.map((r) => (
            <button
              key={r.months}
              type="button"
              role="radio"
              aria-checked={range === r.months}
              onClick={() => setRange(r.months)}
              className={cn(
                "min-h-9 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:px-4",
                range === r.months
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="max-sm:hidden">Last </span>
              {r.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowTable((v) => !v)}>
          <TableIcon aria-hidden />
          {showTable ? "Hide table" : "Show as table"}
        </Button>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          icon={WalletIcon}
          label="Total sales"
          value={formatPeso(now.sales)}
          change={change(now.sales, before.sales)}
          range={range}
        />
        <Kpi
          icon={CalendarCheckIcon}
          label="Bookings"
          value={String(now.bookings)}
          change={change(now.bookings, before.bookings)}
          range={range}
        />
        <Kpi
          icon={ReceiptIcon}
          label="Average per booking"
          value={formatPeso(now.average)}
          change={change(now.average, before.average)}
          range={range}
        />
        <Kpi
          icon={CrownIcon}
          label="Top earner"
          value={top?.label ?? "—"}
          note={
            top ? `${Math.round((top.salesCents / now.sales) * 100)}% of sales` : "No sales yet"
          }
          small
        />
      </ul>

      <section className="rounded-3xl border bg-card p-4 sm:p-6">
        <h2 className="text-xl font-semibold">Sales per month</h2>
        <p className="text-sm text-muted-foreground">
          Booking totals (with add-ons and VAT) by shoot date, for bookings that are paid, confirmed
          or done. Hover or tap a bar for details.
        </p>
        <MonthlyChart key={range} months={current} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border bg-card p-4 sm:p-6">
          <h2 className="text-xl font-semibold">Sales by package type</h2>
          <p className="text-sm text-muted-foreground">Which kinds of shoots bring in the most.</p>
          {byCategory.length > 0 ? (
            <CategoryBars rows={byCategory} total={now.sales} />
          ) : (
            <Empty>No bookings in this period yet.</Empty>
          )}
        </section>

        <section className="rounded-3xl border bg-card p-4 sm:p-6">
          <h2 className="text-xl font-semibold">How clients paid</h2>
          <p className="text-sm text-muted-foreground">
            Money received in this period ({formatPeso(received)}), by payment method.
          </p>
          {received > 0 ? (
            <MethodSplit rows={byMethod} total={received} />
          ) : (
            <Empty>No payments received in this period yet.</Empty>
          )}
        </section>
      </div>

      <WorkshopSummary months={current} />

      {showTable && <MonthTable months={current} />}
    </div>
  );
}

/** Workshop sign-ups in the period and who came, by price category; nothing without sign-ups. */
function WorkshopSummary({ months }: { months: SalesMonth[] }) {
  const signUps = sum(months.map((m) => m.workshop.signUps));
  if (signUps === 0) return null;
  const rows = ATTENDEE_CATEGORIES.map((c) => ({
    ...c,
    people: sum(months.map((m) => m.workshop.people[c.value]?.people ?? 0)),
    cents: sum(months.map((m) => m.workshop.people[c.value]?.cents ?? 0)),
  }));
  const people = sum(rows.map((r) => r.people));
  return (
    <section className="rounded-3xl border bg-card p-4 sm:p-6">
      <h2 className="text-xl font-semibold">Workshop</h2>
      <p className="text-sm text-muted-foreground">
        {signUps} {signUps === 1 ? "sign-up" : "sign-ups"} for {people}{" "}
        {people === 1 ? "person" : "people"} in this period (paid, confirmed or done), by price
        category. Prices are per person, before VAT.
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <li key={r.value} className="rounded-2xl bg-muted/60 p-4">
            <p className="text-sm font-semibold text-muted-foreground">{r.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {r.people} {r.people === 1 ? "person" : "people"}
            </p>
            <p className="text-sm text-muted-foreground tabular-nums">{formatPeso(r.cents)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/** Signed % change, or null when there's nothing to compare against. */
function change(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}

function Kpi({
  icon: Icon,
  label,
  value,
  change,
  range,
  note,
  small,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  change?: number | null;
  range?: number;
  note?: string;
  small?: boolean;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <li className="flex flex-col gap-2 rounded-3xl border bg-card p-4 sm:p-5">
      <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <span className="grid size-8 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        {label}
      </span>
      <span
        className={cn(
          "font-semibold break-words",
          small ? "font-heading text-xl leading-tight" : "text-2xl sm:text-3xl",
        )}
      >
        {value}
      </span>
      {change != null && (
        <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold",
              up ? "bg-secondary text-secondary-foreground" : "bg-destructive/10 text-destructive",
            )}
          >
            {up ? (
              <ArrowUpRightIcon className="size-3" aria-hidden />
            ) : (
              <ArrowDownRightIcon className="size-3" aria-hidden />
            )}
            {up ? "+" : ""}
            {change}%
          </span>
          vs the {range} months before
        </span>
      )}
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </li>
  );
}

/** Nice round axis ticks from 0 to just above `max`. */
function ticks(max: number): number[] {
  if (max <= 0) return [0];
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough)!;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

function MonthlyChart({ months }: { months: SalesMonth[] }) {
  const [active, setActive] = useState<number | null>(null);
  // Bars grow from the baseline on first paint (the parent remounts this per range).
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const axis = ticks(Math.max(...months.map((m) => m.salesCents)));
  // At least ₱1 so an empty period draws flat bars instead of dividing by zero.
  const top = Math.max(axis[axis.length - 1]!, 100);
  const maxIndex = months.reduce(
    (best, m, i) => (m.salesCents > months[best]!.salesCents ? i : best),
    0,
  );
  const last = months.length - 1;
  const shown = active ?? null;

  return (
    <div className="mt-5">
      <div className="relative h-64 pl-12 sm:h-72">
        {/* Gridlines + y-axis ticks */}
        {axis.map((t) => (
          <div
            key={t}
            className="pointer-events-none absolute right-0 left-12 border-t border-border"
            style={{ bottom: `${(t / top) * 100}%` }}
          >
            <span className="absolute -top-2 -left-12 w-10 text-right text-[0.7rem] text-muted-foreground tabular-nums">
              {pesoCompact(t)}
            </span>
          </div>
        ))}

        <ol className="relative flex h-full items-end" onPointerLeave={() => setActive(null)}>
          {months.map((m, i) => {
            const pct = (m.salesCents / top) * 100;
            const labelled = i === maxIndex || i === last;
            return (
              <li key={m.month} className="relative flex h-full flex-1 justify-center">
                <button
                  type="button"
                  aria-label={`${m.longLabel}${i === last ? " (including upcoming shoots)" : ""}: ${formatPeso(m.salesCents)} from ${m.bookings} bookings`}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(i)}
                  className="group/bar flex h-full w-full items-end justify-center rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "relative w-[min(24px,60%)] rounded-t-[4px] bg-primary transition-[height,opacity] duration-700 ease-out",
                      i === last && "opacity-70",
                      shown !== null && shown !== i && "opacity-40",
                    )}
                    style={{ height: grown ? `${pct}%` : "0%", transitionDelay: `${i * 35}ms` }}
                  >
                    {labelled && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[0.7rem] font-bold whitespace-nowrap text-foreground">
                        {pesoCompact(m.salesCents)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {shown !== null && (
          <Tooltip
            month={months[shown]!}
            index={shown}
            count={months.length}
            partial={shown === last}
          />
        )}
      </div>

      {/* X-axis */}
      <ol className="mt-2 flex pl-12" aria-hidden>
        {months.map((m, i) => (
          <li
            key={m.month}
            className={cn(
              "flex-1 text-center text-[0.7rem] text-muted-foreground",
              // On phones with 12 bars, label every other month.
              months.length > 6 && i % 2 === 1 && "max-sm:invisible",
            )}
          >
            {m.label}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        The lighter bar is this month, including shoots still to come.
      </p>
    </div>
  );
}

function Tooltip({
  month,
  index,
  count,
  partial,
}: {
  month: SalesMonth;
  index: number;
  count: number;
  partial: boolean;
}) {
  // Keep the card inside the chart: anchor to the bar, flip near the right edge.
  const center = ((index + 0.5) / count) * 100;
  const flip = center > 60;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-2 z-10 w-44 animate-in rounded-2xl border bg-popover p-3 text-popover-foreground shadow-lg duration-150 zoom-in-95 fade-in"
      style={
        flip
          ? { right: `calc((100% - 3rem) * ${1 - center / 100} + 0.75rem)` }
          : { left: `calc(3rem + (100% - 3rem) * ${center / 100} + 0.75rem)` }
      }
    >
      <p className="text-xs text-muted-foreground">
        {month.longLabel}
        {partial && " (incl. upcoming)"}
      </p>
      <p className="font-heading text-xl font-semibold">{formatPeso(month.salesCents)}</p>
      <p className="text-xs text-muted-foreground">
        <span className="font-bold text-foreground">{month.bookings}</span> bookings
      </p>
    </div>
  );
}

function CategoryBars({
  rows,
  total,
}: {
  rows: { value: ServiceCategory; label: string; salesCents: number; bookings: number }[];
  total: number;
}) {
  const max = rows[0]?.salesCents ?? 1;
  return (
    <ul className="mt-5 space-y-4">
      {rows.map((r) => (
        <li key={r.value}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold">{r.label}</span>
            <span className="shrink-0 text-muted-foreground">
              <span className="font-bold text-foreground">{formatPeso(r.salesCents)}</span> ·{" "}
              {Math.round((r.salesCents / total) * 100)}%
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full origin-left animate-in rounded-full bg-primary duration-700 ease-out slide-in-from-left-full"
              style={{ width: `${(r.salesCents / max) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{r.bookings} bookings</p>
        </li>
      ))}
    </ul>
  );
}

function MethodSplit({
  rows,
  total,
}: {
  rows: { value: PaymentMethod; label: string; cents: number }[];
  total: number;
}) {
  return (
    <div className="mt-5">
      {/* One stacked bar; segments separated by a 2px surface gap. */}
      <div className="flex h-10 gap-0.5 overflow-hidden rounded-xl" aria-hidden>
        {rows.map((r) => (
          <div
            key={r.value}
            className={cn("h-full transition-[flex-grow] duration-700", METHOD_COLORS[r.value])}
            style={{ flexGrow: r.cents, flexBasis: 0 }}
            title={`${r.label}: ${formatPeso(r.cents)}`}
          />
        ))}
      </div>
      <ul className="mt-5 space-y-3">
        {rows.map((r) => (
          <li key={r.value} className="flex items-center gap-3 text-sm">
            <span
              className={cn("size-3 shrink-0 rounded-[3px]", METHOD_COLORS[r.value])}
              aria-hidden
            />
            <span className="flex-1 font-semibold">{r.label}</span>
            <span className="font-bold">{Math.round((r.cents / total) * 100)}%</span>
            <span className="w-24 text-right text-muted-foreground tabular-nums">
              {formatPeso(r.cents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthTable({ months }: { months: SalesMonth[] }) {
  return (
    <section className="animate-in overflow-hidden rounded-3xl border bg-card duration-300 fade-in slide-in-from-top-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Sales per month</caption>
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Month</th>
              <th className="px-4 py-3 text-right font-semibold">Bookings</th>
              <th className="px-4 py-3 text-right font-semibold">Sales</th>
              <th className="px-4 py-3 text-right font-semibold">Average</th>
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {[...months].reverse().map((m) => (
              <tr key={m.month}>
                <td className="px-4 py-3 font-semibold">{m.longLabel}</td>
                <td className="px-4 py-3 text-right">{m.bookings}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatPeso(m.salesCents)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {m.bookings ? formatPeso(Math.round(m.salesCents / m.bookings / 100) * 100) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
