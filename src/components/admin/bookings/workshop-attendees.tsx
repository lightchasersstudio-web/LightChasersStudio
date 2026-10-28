"use client";

import { CheckIcon, MapPinIcon, PhoneIcon, XIcon } from "lucide-react";
import { useTransition } from "react";

import { handleResult } from "@/components/admin/form-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/utils/money";
import { ATTENDEE_CATEGORIES, type AttendeeCategory } from "@/lib/validations/booking";
import { reviewStudentId } from "@/server/actions/admin-bookings";

export type WorkshopAttendee = {
  id: string;
  position: number;
  fullName: string;
  /** Null on sign-ups made before contact details were asked for. */
  phone: string | null;
  address: string | null;
  category: AttendeeCategory;
  priceCents: number;
  idStatus: "pending" | "accepted" | "rejected" | null;
  /** Short-lived link to the student ID photo (private bucket), if any. */
  idUrl: string | null;
};

const STATUS = {
  pending: { label: "ID to check", className: "bg-accent text-accent-foreground" },
  accepted: { label: "ID accepted", className: "bg-sage/40 text-foreground" },
  rejected: { label: "ID rejected", className: "bg-destructive/15 text-destructive" },
} as const;

/**
 * Who's on a workshop sign-up: certificate names, price categories and, for
 * students, the ID photo to accept or reject. A rejection only marks it; the
 * studio then sorts out the price with the client by hand (Edit booking).
 */
export function WorkshopAttendees({ attendees }: { attendees: WorkshopAttendee[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Who&apos;s coming (names for certificates)</p>
      <ul className="space-y-3">
        {attendees.map((a) => (
          <AttendeeRow key={a.id} attendee={a} />
        ))}
      </ul>
    </div>
  );
}

function AttendeeRow({ attendee: a }: { attendee: WorkshopAttendee }) {
  const [pending, startTransition] = useTransition();
  const review = (status: "accepted" | "rejected") =>
    startTransition(async () => {
      handleResult(
        await reviewStudentId({ attendeeId: a.id, status }),
        status === "accepted"
          ? `${a.fullName}'s student ID accepted.`
          : `${a.fullName}'s student ID rejected. Contact the client about the price.`,
      );
    });
  const category = ATTENDEE_CATEGORIES.find((c) => c.value === a.category)!.label;

  return (
    <li className="rounded-2xl border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span>
          <span className="text-muted-foreground">{a.position}.</span> <strong>{a.fullName}</strong>{" "}
          · {category}
        </span>
        <span className="font-semibold">{formatPeso(a.priceCents)}</span>
      </div>
      {(a.phone || a.address) && (
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          {a.phone && (
            <a
              href={`tel:${a.phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
            >
              <PhoneIcon className="size-3.5" aria-hidden />
              {a.phone}
            </a>
          )}
          {a.address && (
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
              {a.address}
            </span>
          )}
        </p>
      )}
      {a.category === "student" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {a.idUrl ? (
            <a
              href={a.idUrl}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg ring-1 ring-border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              aria-label={`Open ${a.fullName}'s student ID photo`}
            >
              {/* A signed link to a private photo, so not next/image (no optimizer cache). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.idUrl} alt="" className="h-20 w-32 object-cover" />
            </a>
          ) : (
            <span className="text-muted-foreground">ID photo not found.</span>
          )}
          {a.idStatus && (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                STATUS[a.idStatus].className,
              )}
            >
              {STATUS[a.idStatus].label}
            </span>
          )}
          <span className="ml-auto flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={a.idStatus === "accepted" ? "default" : "outline"}
              disabled={pending || a.idStatus === "accepted"}
              onClick={() => review("accepted")}
            >
              <CheckIcon aria-hidden />
              Accept
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || a.idStatus === "rejected"}
              onClick={() => review("rejected")}
            >
              <XIcon aria-hidden />
              Reject
            </Button>
          </span>
          {a.idStatus === "rejected" && (
            <p className="w-full text-xs text-muted-foreground">
              Not a valid student ID: contact the client and change the price in Edit booking if
              needed.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
