"use client";

import { differenceInCalendarDays } from "date-fns";
import { CheckIcon, CircleIcon, PartyPopperIcon } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { businessToday, manilaDate, tzDate } from "@/lib/utils/business-date";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/utils/money";
import type { ClientBookingView } from "@/server/actions/booking";

const noop = () => () => {};
const prepKey = (reference: string) => `lcs:prep-read:${reference}`;
const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

/**
 * "Your shoot is in 12 days" and a short checklist (confirmed, paid, location,
 * prep guide) on the client's booking page, for upcoming bookings only.
 */
export function BookingCountdown({ booking }: { booking: ClientBookingView }) {
  const { summary, status } = booking;
  const key = prepKey(summary.reference);
  const storedPrep = useSyncExternalStore(
    noop,
    () => readFlag(key),
    () => false,
  );
  const [prepClicked, setPrepClicked] = useState(false);
  // Today in Manila, read on the client only (the clock isn't known while prerendering).
  const today = useSyncExternalStore(noop, businessToday, () => null);

  const active = status === "pending" || status === "confirmed";
  if (!active || !today) return null;
  const days = differenceInCalendarDays(tzDate(manilaDate(summary.startAt)), tzDate(today));
  if (days < 0) return null;

  const workshop = Boolean(summary.people);
  const what = workshop ? "workshop" : "shoot";
  const headline =
    days === 0
      ? `Your ${what} is today!`
      : days === 1
        ? `Your ${what} is tomorrow!`
        : `Your ${what} is in ${days} days`;
  const balance = booking.balanceCents;
  const items = [
    {
      done: status === "confirmed",
      text: status === "confirmed" ? "Confirmed by the studio" : "Waiting for our confirmation",
    },
    {
      done: summary.paidCents > 0 && balance === 0,
      text:
        balance === 0
          ? "Fully paid"
          : summary.paidCents > 0
            ? `Deposit paid · balance ${formatPeso(balance)} to go`
            : `${formatPeso(balance)} to pay`,
    },
    ...(workshop
      ? []
      : [
          {
            done: Boolean(summary.location),
            text: summary.location
              ? `Location: ${summary.location}`
              : "Location not set yet: message us where the shoot will be",
          },
        ]),
  ];
  const prepDone = storedPrep || prepClicked;

  return (
    <section aria-labelledby="countdown" className="rounded-3xl border bg-card p-5 sm:p-6">
      <h2 id="countdown" className="flex items-center gap-2 text-xl font-semibold">
        <PartyPopperIcon className="size-5 text-terracotta" aria-hidden />
        {headline}
      </h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {items.map((item) => (
          <ChecklistItem key={item.text} done={item.done}>
            {item.text}
          </ChecklistItem>
        ))}
        <ChecklistItem done={prepDone}>
          <Link
            href="/prepare"
            onClick={() => {
              setPrepClicked(true);
              try {
                localStorage.setItem(key, "1");
              } catch {
                // Not remembered: no harm.
              }
            }}
            className="font-semibold text-terracotta-ink underline-offset-4 hover:underline"
          >
            Read how to prepare
          </Link>
          {prepDone ? " (done)" : ""}
        </ChecklistItem>
      </ul>
    </section>
  );
}

function ChecklistItem({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
          done ? "bg-primary text-primary-foreground" : "text-muted-foreground",
        )}
      >
        {done ? (
          <CheckIcon className="size-3.5" aria-hidden />
        ) : (
          <CircleIcon className="size-4" aria-hidden />
        )}
      </span>
      <span className={cn(done && "text-muted-foreground")}>
        <span className="sr-only">{done ? "Done: " : "To do: "}</span>
        {children}
      </span>
    </li>
  );
}
