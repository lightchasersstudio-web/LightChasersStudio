"use client";

import { ArrowRightIcon, Loader2Icon, MailCheckIcon, SearchIcon, TicketIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { useSavedBookings } from "@/components/booking/saved-bookings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatBookingWhen } from "@/lib/booking/booking-summary";
import { parseFinderQuery } from "@/lib/booking/reference";
import { cn } from "@/lib/utils";
import { emailMyBookings } from "@/server/actions/booking";

type State =
  { kind: "idle" } | { kind: "error"; message: string } | { kind: "sent"; email: string };

/**
 * "Already booked? Find your booking": a small link that opens the finder in a
 * pop-up (owner, 2026-11-11: it shouldn't compete with "Book now" on the page).
 */
export function BookingFinderDialog({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            className,
          )}
        >
          <TicketIcon className="size-4 text-terracotta-ink" aria-hidden />
          Already booked?
          <span className="font-semibold text-foreground underline underline-offset-4">
            Find your booking
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Find your booking</DialogTitle>
          <DialogDescription>
            Enter your booking reference, or the email you booked with and we&apos;ll send your
            references to it.
          </DialogDescription>
        </DialogHeader>
        <BookingFinder />
      </DialogContent>
    </Dialog>
  );
}

/**
 * The finder itself. A reference opens /booking with it filled in (the email
 * is still asked there); an email gets the references sent to that inbox, so
 * nobody can see someone else's booking by typing their email.
 */
function BookingFinder() {
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
    <div className="min-w-0">
      {state.kind === "sent" ? (
        <div role="status" className="rounded-2xl bg-sage/25 p-4">
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
        <form onSubmit={onSubmit} noValidate role="search" aria-label="Find your booking">
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Booking reference or email</span>
              <SearchIcon
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
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
                placeholder="Reference or email"
                aria-describedby={hintId}
                aria-invalid={state.kind === "error" || undefined}
                className="h-11 w-full rounded-full border border-input bg-background pr-4 pl-10 text-base transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive sm:text-sm"
              />
            </label>
            <Button type="submit" className="h-11 shrink-0" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" aria-hidden />}
              Find
            </Button>
          </div>
          <p
            id={hintId}
            className={cn(
              "mt-2 text-sm",
              state.kind === "error" ? "font-semibold text-destructive" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {state.kind === "error" ? state.message : "Like BK-2026-1A2B3C, or you@example.com"}
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
                  className="group inline-flex min-h-10 items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm transition-colors hover:border-terracotta focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
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
