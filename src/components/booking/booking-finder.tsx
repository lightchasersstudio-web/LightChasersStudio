"use client";

import { ArrowRightIcon, Loader2Icon, MailCheckIcon, SearchIcon, TicketIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { useSavedBookings } from "@/components/booking/saved-bookings";
import { Button } from "@/components/ui/button";
import { formatBookingWhen } from "@/lib/booking/booking-summary";
import { parseFinderQuery } from "@/lib/booking/reference";
import { cn } from "@/lib/utils";
import { emailMyBookings } from "@/server/actions/booking";

type State =
  { kind: "idle" } | { kind: "error"; message: string } | { kind: "sent"; email: string };

/**
 * "Find your booking" search bar. A reference opens /booking with it filled in
 * (the email is still asked there); an email gets the references sent to that
 * inbox, so nobody can see someone else's booking by typing their email.
 */
export function BookingFinder({ className }: { className?: string }) {
  const router = useRouter();
  const saved = useSavedBookings();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [pending, setPending] = useState(false);
  const hintId = useId();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = parseFinderQuery(query);
    if (q.kind === "invalid") {
      setState({
        kind: "error",
        message: "Type your booking reference (like BK-2026-1A2B3C) or the email you booked with.",
      });
      return;
    }
    if (q.kind === "reference") {
      setPending(true);
      router.push(`/booking?ref=${q.value}`);
      return;
    }
    setPending(true);
    try {
      const result = await emailMyBookings({ email: q.value });
      setState(
        result.ok
          ? { kind: "sent", email: result.data.email }
          : { kind: "error", message: result.error },
      );
    } catch {
      setState({ kind: "error", message: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("rounded-[2rem] border bg-card p-5 shadow-lg sm:p-7", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="grid size-10 place-items-center rounded-full bg-accent text-terracotta-ink">
          <TicketIcon className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="find-booking" className="text-xl font-semibold">
            Already booked? Find your booking
          </h2>
        </div>
      </div>

      {state.kind === "sent" ? (
        <div role="status" className="mt-4 rounded-2xl bg-sage/25 p-4">
          <p className="flex items-start gap-2 font-semibold">
            <MailCheckIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
            Check your inbox
          </p>
          <p className="mt-1 text-sm">
            If any bookings were made with <strong>{state.email}</strong>, we&apos;ve just emailed
            their references there. Not there in a few minutes? Look in Spam or Promotions.
          </p>
          <Button
            type="button"
            variant="link"
            className="mt-1 h-auto px-0"
            onClick={() => {
              setState({ kind: "idle" });
              setQuery("");
            }}
          >
            Search again
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate role="search" aria-labelledby="find-booking">
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Booking reference or email</span>
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (state.kind === "error") setState({ kind: "idle" });
                }}
                placeholder="Booking reference or email"
                aria-describedby={hintId}
                aria-invalid={state.kind === "error" || undefined}
                className="h-12 w-full rounded-full border border-input bg-background pr-4 pl-12 text-base transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              />
            </label>
            <Button type="submit" size="lg" className="h-12 px-6" disabled={pending}>
              {pending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : (
                <SearchIcon aria-hidden />
              )}
              Find booking
            </Button>
          </div>
          <p
            id={hintId}
            className={cn(
              "mt-2 px-4 text-sm",
              state.kind === "error" ? "font-semibold text-destructive" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {state.kind === "error"
              ? state.message
              : "Enter your booking reference, or your email and we'll send your references to it."}
          </p>
        </form>
      )}

      {saved.length > 0 && state.kind !== "sent" && (
        <div className="mt-4 border-t pt-4">
          <p className="text-sm font-semibold">Booked on this device</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {saved.map((b) => (
              <li key={b.reference}>
                <Link
                  href={`/booking?ref=${b.reference}`}
                  className="group inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm transition-colors hover:border-terracotta focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="font-heading font-semibold tracking-wide">{b.reference}</span>
                  {(b.title || b.startAt) && (
                    <span className="hidden text-muted-foreground sm:inline">
                      {[b.title, b.startAt && formatBookingWhen(b.startAt, null)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  <ArrowRightIcon
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
