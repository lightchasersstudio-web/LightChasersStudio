import { CalendarDaysIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Time record's two ways in: the whole team for one day (daily entry) or one
 * person for a whole cut-off (checking and fixing).
 */
export function DtrViewTabs({
  view,
  date,
  cutoffStart,
}: {
  view: "day" | "person";
  /** The day the "By day" tab opens. */
  date: string;
  /** The cut-off the "By person" tab opens. */
  cutoffStart: string;
}) {
  const tabs = [
    {
      id: "day",
      label: "By day",
      hint: "everyone, one day",
      href: `/admin/dtr/day?date=${date}`,
      icon: CalendarDaysIcon,
    },
    {
      id: "person",
      label: "By person",
      hint: "one person, whole cut-off",
      href: `/admin/dtr?cutoff=${cutoffStart}`,
      icon: UserRoundIcon,
    },
  ] as const;
  return (
    <nav aria-label="Time record view" className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = t.id === view;
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
            <span
              className={cn(
                "font-normal max-sm:hidden",
                active ? "opacity-90" : "text-muted-foreground",
              )}
            >
              · {t.hint}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
