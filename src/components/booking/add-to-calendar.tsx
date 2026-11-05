"use client";

import { CalendarPlusIcon, DownloadIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { googleCalendarUrl, icsFile, type CalendarEvent } from "@/lib/booking/calendar-links";
import { cn } from "@/lib/utils";

const KEY = "lcs:last-booking";

/**
 * The booking just made, kept in this tab only (sessionStorage): the calendar
 * entry, plus the hold end and email so /book/cancelled can count down and
 * retry the payment in one tap.
 */
export type RememberedBooking = CalendarEvent & {
  holdExpiresAt?: string | null;
  email?: string;
};

/** Saved by the wizard just before leaving for payment, so /book/done can offer "Add to calendar". */
export function rememberBooking(event: RememberedBooking) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(event));
  } catch {
    // Private mode or storage blocked: the done page just won't show the buttons.
  }
}

function recall(reference: string): RememberedBooking | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as RememberedBooking | null;
    return saved?.reference === reference ? saved : null;
  } catch {
    return null;
  }
}

const noop = () => () => {};

/** The booking just made in this tab (null if it isn't known, e.g. opened on another device). */
export function useRememberedBooking(reference: string): RememberedBooking | null {
  // Read once on the client; the server render has no sessionStorage.
  const raw = useSyncExternalStore(
    noop,
    () => {
      try {
        return sessionStorage.getItem(KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  return raw ? recall(reference) : null;
}

export function AddToCalendar({
  event,
  className,
  onAdded,
}: {
  event: CalendarEvent;
  className?: string;
  /** Called when either button is used (the entry carries the booking reference). */
  onAdded?: () => void;
}) {
  function download() {
    onAdded?.();
    const url = URL.createObjectURL(new Blob([icsFile(event)], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.reference}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={cn("flex flex-wrap justify-center gap-2", className)}>
      <Button asChild variant="outline">
        <a
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onAdded}
        >
          <CalendarPlusIcon aria-hidden />
          Add to Google Calendar
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </Button>
      <Button type="button" variant="outline" onClick={download}>
        <DownloadIcon aria-hidden />
        Apple / Outlook (.ics)
      </Button>
    </div>
  );
}
