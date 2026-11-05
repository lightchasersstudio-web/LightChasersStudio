"use client";

import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { CalendarClockIcon, CheckIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { handleResult } from "@/components/admin/form-utils";
import { Button } from "@/components/ui/button";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { resolveBookingRequest } from "@/server/actions/admin-bookings";

export type BookingRequestRow = {
  id: string;
  preferred: string | null;
  message: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
};

const when = (iso: string) => format(new TZDate(iso, BUSINESS_TZ), "EEE, d MMM, h:mm a");

/**
 * Reschedule requests the client sent from their booking page. Open ones are a
 * banner with "Change the time" and "Mark handled"; handled ones stay as a note.
 */
export function BookingRequests({
  bookingId,
  requests,
  editable,
}: {
  bookingId: string;
  requests: BookingRequestRow[];
  editable: boolean;
}) {
  const [pending, start] = useTransition();
  if (requests.length === 0) return null;
  const sorted = [...requests].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <section aria-labelledby="client-requests" className="space-y-3">
      <h2 id="client-requests" className="sr-only">
        Client requests
      </h2>
      {sorted.map((r) =>
        r.status === "open" ? (
          <div
            key={r.id}
            role="alert"
            className="space-y-3 rounded-2xl border border-terracotta/50 bg-blush p-4 text-foreground"
          >
            <p className="flex items-center gap-2 font-semibold">
              <CalendarClockIcon className="size-5 text-terracotta-ink" aria-hidden />
              The client asked to reschedule · {when(r.created_at)}
            </p>
            {r.preferred && (
              <p className="text-sm">
                <span className="font-semibold">Preferred:</span> {r.preferred}
              </p>
            )}
            <p className="text-sm whitespace-pre-line">{r.message}</p>
            <div className="flex flex-wrap gap-2">
              {editable && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/bookings/${bookingId}/edit`}>
                    <PencilIcon aria-hidden />
                    Change the time
                  </Link>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    handleResult(await resolveBookingRequest({ id: r.id }), "Marked as handled.");
                  })
                }
              >
                <CheckIcon aria-hidden />
                Mark handled
              </Button>
            </div>
          </div>
        ) : (
          <p
            key={r.id}
            className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground"
          >
            Reschedule request from {when(r.created_at)}
            {r.preferred ? ` (preferred: ${r.preferred})` : ""}, handled
            {r.resolved_at ? ` ${when(r.resolved_at)}` : ""}.
          </p>
        ),
      )}
    </section>
  );
}
