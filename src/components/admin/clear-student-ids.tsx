"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

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
import { clearPastStudentIds } from "@/server/actions/privacy";

/** Workshop admin: delete the student ID photos of workshops that have ended. */
export function ClearStudentIds() {
  const [pending, start] = useTransition();

  return (
    <section
      aria-labelledby="student-ids"
      className="mt-8 space-y-3 rounded-3xl border bg-card p-5 sm:p-6"
    >
      <h2 id="student-ids" className="text-xl font-semibold">
        Student ID photos
      </h2>
      <p className="text-sm text-muted-foreground">
        Once a workshop is over you no longer need the students&apos; ID photos. Our privacy policy
        says they&apos;re deleted after the workshop, so clear them here when it&apos;s done. Photos
        for upcoming workshops are kept.
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" disabled={pending}>
            {pending ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : (
              <Trash2Icon aria-hidden />
            )}
            Delete photos from past workshops
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete past student ID photos?</AlertDialogTitle>
            <AlertDialogDescription>
              The photos of everyone whose workshop has ended are deleted for good. Their bookings
              and price categories stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                start(async () => {
                  const result = await clearPastStudentIds({});
                  if (!result.ok) toast.error(result.error);
                  else if (result.data.deleted === 0) toast.success("No past photos to delete.");
                  else
                    toast.success(
                      `Deleted ${result.data.deleted} ${result.data.deleted === 1 ? "photo" : "photos"}.`,
                    );
                })
              }
            >
              Delete photos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
