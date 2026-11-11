"use client";

import { Loader2Icon, SaveIcon } from "lucide-react";
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
import { savePayroll } from "@/server/actions/payroll";

/** Saves the cut-off's payroll; asks first when it replaces a saved one. */
export function SavePayrollButton({
  cutoff,
  cutoffLabel,
  replaces,
  count,
  blankDays = 0,
}: {
  cutoff: string;
  cutoffLabel: string;
  /** A payroll is already saved for this cut-off. */
  replaces: boolean;
  count: number;
  /** Days left blank so far, across all staff (they don't count in the payslips). */
  blankDays?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await savePayroll({ cutoff });
    setBusy(false);
    if (handleResult(result, `Payroll saved: ${result.ok ? result.data.count : 0} payslips.`)) {
      setOpen(false);
      router.replace(`/admin/payroll?cutoff=${cutoff}`); // back to the saved view
    }
  }

  const label = replaces ? "Save again" : "Save payroll";

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="lg" disabled={count === 0}>
          <SaveIcon aria-hidden />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {replaces ? "Replace" : "Save"} the payroll for {cutoffLabel}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {replaces
              ? `The saved payslips are replaced with ${count} new ones, worked out from today's time record, salaries and benefits.`
              : `This saves ${count} payslips with today's time record, salaries and benefits. Later changes don't alter them unless you save again.`}
          </AlertDialogDescription>
          {blankDays > 0 && (
            <p className="rounded-2xl border border-terracotta/40 bg-blush/40 p-3 text-sm">
              <strong>
                {blankDays} {blankDays === 1 ? "day is" : "days are"} still blank
              </strong>{" "}
              on the time record and won&apos;t count in these payslips. You can save now and save
              again after filling them in.
            </p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              await save();
            }}
          >
            {busy && <Loader2Icon className="animate-spin" aria-hidden />}
            {replaces ? "Replace payslips" : "Save payroll"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
