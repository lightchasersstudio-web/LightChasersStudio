"use client";

import { Loader2Icon, UserRoundXIcon } from "lucide-react";
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
import { namesMatch } from "@/lib/validations/privacy";
import { anonymiseClient } from "@/server/actions/privacy";

/** Owner only: delete a client's personal data on request (typed confirmation). */
export function AnonymiseClient({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();

  return (
    <section
      aria-labelledby="privacy-request"
      className="mt-10 space-y-3 rounded-3xl border border-destructive/40 p-5"
    >
      <h2 id="privacy-request" className="text-xl font-semibold text-destructive">
        Delete this client&apos;s data
      </h2>
      <p className="text-sm text-muted-foreground">
        For a privacy request under RA 10173. Their name, email, phone, booking notes, workshop
        details and student ID photos are deleted. Booking references, amounts and dates stay, so
        your sales records remain correct. Clients with an upcoming booking can&apos;t be deleted
        until it&apos;s cancelled or completed.
      </p>
      <AlertDialog onOpenChange={() => setTyped("")}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" className="text-destructive">
            <UserRoundXIcon aria-hidden />
            Delete personal data
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}&apos;s personal data?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Type the client&apos;s name to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-name">Client&apos;s name</Label>
            <Input
              id="confirm-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={name}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={!namesMatch(typed, name) || pending}
              onClick={() =>
                start(async () => {
                  const result = await anonymiseClient({ id, confirmName: typed });
                  if (handleResult(result, "Personal data deleted.")) router.refresh();
                })
              }
            >
              {pending && <Loader2Icon className="animate-spin" aria-hidden />}
              Delete data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
