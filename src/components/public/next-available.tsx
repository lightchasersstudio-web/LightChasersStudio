"use client";

import { CalendarCheckIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { businessToday, shiftMonth, tzDate } from "@/lib/utils/business-date";
import { getMonthSlots } from "@/server/actions/availability-slots";

type Found = { date: string; count: number } | null;

const MONTHS_TO_SEARCH = 3;

/**
 * "Next free date: Sat, 14 Nov · 4 times" for a package, looked up in the browser
 * (the package page itself is static). Shows nothing if no date is free soon.
 */
export function NextAvailable({ serviceId, bookHref }: { serviceId: string; bookHref: string }) {
  const [found, setFound] = useState<Found | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const first = businessToday().slice(0, 7);
      for (let i = 0; i < MONTHS_TO_SEARCH; i++) {
        const result = await getMonthSlots({ serviceId, month: shiftMonth(first, i) });
        if (cancelled) return;
        if (!result.ok) break;
        const day = result.data.find((d) => d.status === "open" || d.status === "few");
        if (day) return setFound({ date: day.date, count: day.slots.length });
      }
      if (!cancelled) setFound(null);
    })().catch(() => !cancelled && setFound(null));
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  if (found === null) return null;
  return (
    <p
      aria-live="polite"
      className="mt-3 flex items-center gap-2 rounded-2xl bg-sage/20 px-4 py-3 text-sm"
    >
      {found === undefined ? (
        <>
          <Loader2Icon className="size-4 shrink-0 animate-spin" aria-hidden />
          Checking the next free date…
        </>
      ) : (
        <>
          <CalendarCheckIcon className="size-4 shrink-0 text-primary" aria-hidden />
          <span>
            Next free date:{" "}
            <Link href={bookHref} className="font-semibold underline-offset-4 hover:underline">
              {tzDate(found.date).toLocaleDateString("en-PH", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </Link>{" "}
            · {found.count} {found.count === 1 ? "time" : "times"} open
          </span>
        </>
      )}
    </p>
  );
}
