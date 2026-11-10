"use client";

import { ArchiveRestoreIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { deleteEmployee, restoreEmployee } from "@/server/actions/employees";

/** Delete (asks first): the employee leaves every list; their history is kept. */
export function EmployeeDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const result = await deleteEmployee({ id });
    setBusy(false);
    if (handleResult(result, `${name} was deleted. Their history is under Employees → Deleted.`)) {
      setOpen(false);
      router.push("/admin/employees");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive">
          <Trash2Icon aria-hidden />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They disappear from Employees, the time record, payroll and the daily payroll report.
            Their past shifts and payslips are kept and stay viewable under Employees → Deleted,
            where you can restore them if this was a mistake.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              await run();
            }}
          >
            {busy && <Loader2Icon className="animate-spin" aria-hidden />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Brings a deleted employee back as active. */
export function EmployeeRestoreButton({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await restoreEmployee({ id });
        setBusy(false);
        handleResult(result, `${name} is back as an active employee.`);
      }}
    >
      {busy ? (
        <Loader2Icon className="animate-spin" aria-hidden />
      ) : (
        <ArchiveRestoreIcon aria-hidden />
      )}
      Restore
    </Button>
  );
}
