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
import type { BookingStatus } from "@/lib/booking/status";
import { bookingStatusSchema, type BookingStatusInput } from "@/lib/validations/admin-booking";
import { markRefundReviewed, setBookingStatus } from "@/server/actions/admin-bookings";

type Move = "confirmed" | "declined" | "completed" | "cancelled";

const MESSAGES: Record<Move, string> = {
  confirmed: "Booking confirmed.",
  declined: "Booking declined.",
  completed: "Marked as completed.",
  cancelled: "Booking cancelled.",
};

/** Buttons for the status moves that make sense from the current status. */
export function StatusActions({
  id,
  status,
  hasEmail,
}: {
  id: string;
  status: BookingStatus;
  hasEmail: boolean;
}) {
  const [pending, start] = useTransition();
  const move = (to: Exclude<Move, "completed">) =>
    new Promise<boolean>((resolve) =>
      start(async () =>
        resolve(handleResult(await setBookingStatus({ id, status: to }), MESSAGES[to])),
      ),
    );
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
      {["pending_payment", "pending", "confirmed"].includes(status) && (
        <ConfirmMove
          label="Cancel booking"
          title="Cancel this booking?"
          description={`The time becomes free again.${emailNote}`}
          onConfirm={() => move("cancelled")}
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
