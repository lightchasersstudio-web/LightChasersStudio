"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { handleResult } from "@/components/admin/form-utils";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteBooking } from "@/server/actions/admin-bookings";

/** Owner only: permanently delete a test or mistaken booking (typed confirmation). */
export function DeleteBooking({ id, reference }: { id: string; reference: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const matches = typed.trim().toUpperCase() === reference;

  return (
    <section
      aria-labelledby="danger"
      className="space-y-3 rounded-3xl border border-destructive/40 p-5"
    >
      <h2 id="danger" className="text-xl font-semibold text-destructive">
        Danger zone
      </h2>
      <p className="text-sm text-muted-foreground">
        Permanently delete this booking, for tests or mistakes. Bookings with real payments can only
        be cancelled, so your sales records stay correct.
      </p>
      <AlertDialog onOpenChange={() => setTyped("")}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" className="text-destructive">
            <Trash2Icon aria-hidden />
            Delete booking permanently
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {reference} permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Type the booking reference to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-reference">Booking reference</Label>
            <Input
              id="confirm-reference"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={reference}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!matches || pending}
              onClick={() =>
                start(async () => {
                  const result = await deleteBooking({ id, confirmReference: typed });
                  if (handleResult(result, "Booking deleted.")) router.push("/admin/calendar");
                })
              }
            >
              {pending && <Loader2Icon className="animate-spin" aria-hidden />}
              Delete permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
