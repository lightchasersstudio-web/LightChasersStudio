"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelAdvice, CANCEL_REASONS, type CancelReason } from "@/lib/booking/policy";
import type { BookingStatus } from "@/lib/booking/status";
import { formatPeso } from "@/lib/utils/money";
import { bookingStatusSchema, type BookingStatusInput } from "@/lib/validations/admin-booking";
import { markRefundReviewed, setBookingStatus } from "@/server/actions/admin-bookings";

type Move = "confirmed" | "declined" | "completed" | "cancelled" | "no_show";

const MESSAGES: Record<Move, string> = {
  confirmed: "Booking confirmed.",
  declined: "Booking declined.",
  completed: "Marked as completed.",
  cancelled: "Booking cancelled.",
  no_show: "Marked as a no-show.",
};

/** What the studio policy needs to know to advise on a cancellation. */
type PolicyFacts = {
  startAt: string;
  paidCents: number;
  rescheduleFeeCents: number;
  /** The booked time has started (checked on the server), so a no-show can be marked. */
  started: boolean;
};

/** Buttons for the status moves that make sense from the current status. */
export function StatusActions({
  id,
  status,
  hasEmail,
  policy,
}: {
  id: string;
  status: BookingStatus;
  hasEmail: boolean;
  policy: PolicyFacts;
}) {
  const [pending, start] = useTransition();
  const move = (to: Exclude<Move, "completed">, cancelReason?: CancelReason) =>
    new Promise<boolean>((resolve) =>
      start(async () =>
        resolve(
          handleResult(await setBookingStatus({ id, status: to, cancelReason }), MESSAGES[to]),
        ),
      ),
    );
  const kept =
    policy.paidCents > 0
      ? `the ${formatPeso(policy.paidCents)} paid is kept, not refunded`
      : "nothing was paid";
  const emailNote = hasEmail ? " The client will get an email." : "";

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" && (
        <>
          <Button type="button" disabled={pending} onClick={() => move("confirmed")}>
            {pending && <Loader2Icon className="animate-spin" aria-hidden />}
            Confirm booking
          </Button>
          <ConfirmMove
            label="Decline"
            title="Decline this booking?"
            description={`The time becomes free again.${emailNote} Refund any deposit in PayMongo yourself.`}
            onConfirm={() => move("declined")}
          />
        </>
      )}
      {status === "confirmed" && <CompleteDialog id={id} hasEmail={hasEmail} />}
      {status === "confirmed" && policy.started && (
        <ConfirmMove
          label="Mark no-show"
          title="The client didn't come?"
          description={`Policy 1.7: a no-show can't be rescheduled and ${kept}. They're welcome to make a new booking.`}
          onConfirm={() => move("no_show")}
        />
      )}
      {["pending_payment", "pending", "confirmed"].includes(status) && (
        <CancelDialog
          emailNote={emailNote}
          policy={policy}
          onConfirm={(reason) => move("cancelled", reason)}
        />
      )}
    </div>
  );
}

/**
 * "Mark completed" with an optional link to the photos (e.g. Google Drive). With
 * a link, the client's thank-you email says their photos are ready and links them.
 */
function CompleteDialog({ id, hasEmail }: { id: string; hasEmail: boolean }) {
  const [open, setOpen] = useState(false);
  const form = useForm<BookingStatusInput, unknown, z.output<typeof bookingStatusSchema>>({
    resolver: zodResolver(bookingStatusSchema),
    defaultValues: { id, status: "completed", photosUrl: "" },
  });

  async function onSubmit(values: z.output<typeof bookingStatusSchema>) {
    const message = !hasEmail
      ? MESSAGES.completed
      : values.photosUrl
        ? "Marked as completed. The client gets an email saying their photos are ready."
        : "Marked as completed. The client gets a thank-you email asking for a review.";
    if (handleResult(await setBookingStatus(values), message, form)) setOpen(false);
  }

  const submitting = form.formState.isSubmitting;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) setOpen(next);
        if (next) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Mark completed
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>Mark this booking completed?</DialogTitle>
            <DialogDescription>
              {hasEmail
                ? "Paste the link to their photos and the client's email will say their photos are ready, with a button to open them. Leave it empty to send just the thank-you email."
                : "This booking has no email address, so nothing is sent. Share the photos through Messenger instead (Quick replies → Photos are ready)."}
            </DialogDescription>
          </DialogHeader>
          {hasEmail && (
            <TextField
              control={form.control}
              name="photosUrl"
              label="Link to the photos (optional)"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://drive.google.com/…"
              maxLength={300}
              description="Check the folder is shared as “Anyone with the link” so the client can open it."
            />
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                Not yet
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2Icon className="animate-spin" aria-hidden />}
              Mark completed
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Cancel booking" asks why (studio policy 1.6–1.8) and says what the policy
 * means for the money: a client cancellation keeps what was paid; force majeure
 * refunds everything (the booking is then flagged for a refund check).
 */
function CancelDialog({
  emailNote,
  policy,
  onConfirm,
}: {
  emailNote: string;
  policy: PolicyFacts;
  onConfirm: (reason: CancelReason) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<CancelReason>("client");
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setReason("client");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="text-destructive hover:text-destructive">
          Cancel booking
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>The time becomes free again.{emailNote}</AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">Why?</legend>
          {CANCEL_REASONS.map((r) => (
            <label
              key={r.value}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent/50"
            >
              <input
                type="radio"
                name="cancel-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                <span className="block font-medium">{r.label}</span>
                <span className="block text-muted-foreground">{r.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p role="status" className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
          {cancelAdvice(reason, policy)}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              const done = await onConfirm(reason);
              setBusy(false);
              if (done) setOpen(false);
            }}
          >
            {busy && <Loader2Icon className="animate-spin" aria-hidden />}
            Cancel booking
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmMove({
  label,
  title,
  description,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="text-destructive hover:text-destructive">
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              const done = await onConfirm();
              setBusy(false);
              if (done) setOpen(false);
            }}
          >
            {busy && <Loader2Icon className="animate-spin" aria-hidden />}
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Shown when a PayMongo payment needs a refund check (late, duplicate, or on a closed booking). */
export function RefundReviewBanner({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center"
    >
      <p className="flex-1 text-sm font-semibold">
        A PayMongo payment needs a check: it arrived after this booking was cancelled or already
        paid, or after its time filled up. Refund the client in PayMongo or move them to another
        time, then mark it reviewed.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            handleResult(await markRefundReviewed({ id }), "Marked as reviewed.");
          })
        }
      >
        Mark reviewed
      </Button>
    </div>
  );
}
