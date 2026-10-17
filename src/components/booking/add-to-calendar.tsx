"use client";

import { CalendarPlusIcon, DownloadIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { googleCalendarUrl, icsFile, type CalendarEvent } from "@/lib/booking/calendar-links";
import { cn } from "@/lib/utils";

const KEY = "lcs:last-booking";

/** Saved by the wizard just before leaving for payment, so /book/done can offer "Add to calendar". */
export function rememberBooking(event: CalendarEvent) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(event));
  } catch {
    // Private mode or storage blocked: the done page just won't show the buttons.
  }
}

function recall(reference: string): CalendarEvent | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as CalendarEvent | null;
    return saved?.reference === reference ? saved : null;
  } catch {
    return null;
  }
}

const noop = () => () => {};

/** "Add to calendar" for the booking just made in this tab (nothing if it isn't known). */
export function AddToCalendarFromSession({ reference }: { reference: string }) {
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
  const event = raw ? recall(reference) : null;
  return event ? <AddToCalendar event={event} className="mt-6" /> : null;
}

export function AddToCalendar({ event, className }: { event: CalendarEvent; className?: string }) {
  function download() {
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
        <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
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
