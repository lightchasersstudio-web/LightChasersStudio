"use client";

import { Loader2Icon, UserCheckIcon, UserXIcon } from "lucide-react";
import { useState } from "react";

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
import { setEmployeeActive } from "@/server/actions/employees";

/** Deactivate (asks first) or reactivate an employee. */
export function EmployeeStatusButton({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(next: boolean) {
    setBusy(true);
    const result = await setEmployeeActive({ id, isActive: next });
    setBusy(false);
    if (handleResult(result, next ? `${name} is active again.` : `${name} is now inactive.`)) {
      setOpen(false);
    }
  }

  if (!isActive) {
    return (
      <Button variant="outline" disabled={busy} onClick={() => run(true)}>
        {busy ? (
          <Loader2Icon className="animate-spin" aria-hidden />
        ) : (
          <UserCheckIcon aria-hidden />
        )}
        Reactivate
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          <UserXIcon aria-hidden />
          Deactivate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They won&apos;t get payslips or appear in the time record from now on. Their details and
            past payslips are kept, and you can reactivate them any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              await run(false);
            }}
          >
            {busy && <Loader2Icon className="animate-spin" aria-hidden />}
            Deactivate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
