"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import {
  CheckIcon,
  CircleAlertIcon,
  Loader2Icon,
  PhoneIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { SelectField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { RecordPaymentForm } from "@/components/admin/bookings/record-payment-form";
import { StatusBadge } from "@/components/booking/status-badge";
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
import {
  CHECK_IN_STEPS,
  checkInProgress,
  depositKeptCents,
  depositState,
  type CheckInStep,
} from "@/lib/booking/check-in";
import { providerLabel, RECORDED_PROVIDERS } from "@/lib/payments/providers";
import { cn } from "@/lib/utils";
import { BUSINESS_TZ } from "@/lib/utils/business-date";
import { centsToPesoInput, formatPeso } from "@/lib/utils/money";
import {
  collectDepositSchema,
  returnDepositSchema,
  type CollectDepositInput,
  type ReturnDepositInput,
} from "@/lib/validations/admin-booking";
import {
  collectSecurityDeposit,
  returnSecurityDeposit,
  setCheckInStep,
  undoSecurityDeposit,
} from "@/server/actions/check-in";
import type { CheckInBooking } from "@/server/queries/check-in";

const time = (iso: string) => format(new TZDate(iso, BUSINESS_TZ), "h:mm a");

/**
 * Shoot day for one booking (Studio Policy 1.3, 2.3, 2.5, 3.9): ID, check-in
 * and check-out inspections, the balance and the security deposit. Used on the
 * Today page and the booking page (`compact` leaves out the client header).
 */
export function CheckInCard({ b, compact = false }: { b: CheckInBooking; compact?: boolean }) {
  const balance = Math.max(b.priceCents - b.paidCents, 0);
  const { done, total } = checkInProgress({
    studio: b.studio,
    steps: b.steps,
    balanceCents: balance,
    deposit: b.deposit,
  });
  const allDone = done === total;

  return (
    <article
      aria-label={`${b.contactName}, ${time(b.startAt)}`}
      className={cn("rounded-3xl border bg-card p-4 sm:p-5", allDone && "border-sage")}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        {compact ? (
          <h2 className="text-xl font-semibold">Shoot day</h2>
        ) : (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-terracotta-ink">
              {time(b.startAt)}
              {b.endAt && ` – ${time(b.endAt)}`}
            </p>
            <h2 className="text-xl font-semibold break-words">
              <Link href={`/admin/bookings/${b.id}`} className="underline-offset-4 hover:underline">
                {b.contactName}
              </Link>
            </h2>
            <p className="text-sm text-muted-foreground">
              {b.serviceName} · {b.participants} {b.participants === 1 ? "person" : "people"} ·{" "}
              {b.reference}
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!compact && <StatusBadge status={b.status} />}
          <span
            className={cn(
              "rounded-full px-3 py-1 text-sm font-semibold tabular-nums",
              allDone ? "bg-sage/30" : "bg-muted",
            )}
          >
            {allDone ? "All done" : `${done} of ${total} done`}
          </span>
        </div>
      </header>

      {!compact && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${b.contactPhone.replace(/[^\d+]/g, "")}`}>
              <PhoneIcon aria-hidden />
              {b.contactPhone}
            </a>
          </Button>
          {b.sensitiveShoot && (
            <span className="rounded-full bg-blush px-3 py-1">Nude or sensitive shoot</span>
          )}
          {b.btsOptOut && (
            <span className="rounded-full bg-blush px-3 py-1">No behind-the-scenes posts</span>
          )}
        </div>
      )}
      {!compact && b.specialRequests && (
        <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
          “{b.specialRequests}”
        </p>
      )}

      <ul className="mt-4 divide-y rounded-2xl border">
        {b.studio &&
          CHECK_IN_STEPS.slice(0, 2).map((s) => <StepRow key={s.step} b={b} step={s.step} />)}
        <BalanceRow b={b} balance={balance} />
        {b.studio && <DepositRow b={b} />}
        {b.studio && <StepRow b={b} step="inspect_out" />}
      </ul>
    </article>
  );
}

function StepRow({ b, step }: { b: CheckInBooking; step: CheckInStep }) {
  const s = CHECK_IN_STEPS.find((x) => x.step === step)!;
  const at = b.steps[s.column];
  const [pending, start] = useTransition();
  return (
    <li className="flex items-start gap-3 p-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={at !== null}
        aria-label={s.label}
        disabled={pending}
        onClick={() =>
          start(async () => {
            handleResult(
              await setCheckInStep({ bookingId: b.id, step, done: at === null }),
              at === null ? `${s.label}: done.` : `${s.label}: unticked.`,
            );
          })
        }
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-lg border-2 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          at !== null ? "border-primary bg-primary text-primary-foreground" : "border-input",
        )}
      >
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
        ) : (
          at !== null && <CheckIcon className="size-4" aria-hidden />
        )}
      </button>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {s.label}
          {at && <span className="font-normal text-muted-foreground"> · {time(at)}</span>}
        </p>
        <p className="text-muted-foreground">{s.hint}</p>
      </div>
    </li>
  );
}

function BalanceRow({ b, balance }: { b: CheckInBooking; balance: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-lg",
          balance > 0 ? "bg-blush text-terracotta-ink" : "bg-primary text-primary-foreground",
        )}
        aria-hidden
      >
        {balance > 0 ? <WalletIcon className="size-4" /> : <CheckIcon className="size-4" />}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {balance > 0 ? `Balance due: ${formatPeso(balance)}` : "Paid in full"}
        </p>
        <p className="text-muted-foreground">
          {balance > 0
            ? "Settled before or on arrival (policy 1.3). The receipt is emailed when you record it."
            : `${formatPeso(b.paidCents)} paid.`}
        </p>
      </div>
      {balance > 0 && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Record payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Balance from {b.contactName}</DialogTitle>
              <DialogDescription>
                {formatPeso(balance)} still due. A receipt is emailed to the client.
              </DialogDescription>
            </DialogHeader>
            <RecordPaymentForm
              bookingId={b.id}
              amount={centsToPesoInput(balance)}
              stacked
              onRecorded={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </li>
  );
}

function DepositRow({ b }: { b: CheckInBooking }) {
  const d = b.deposit;
  const state = depositState(d);
  const [pending, start] = useTransition();
  const kept = depositKeptCents(d);

  const text =
    state === "returned"
      ? kept > 0
        ? `Returned ${formatPeso(d.returnedCents!)}, kept ${formatPeso(kept)}${d.note ? `: ${d.note}` : ""}`
        : `Returned in full (${formatPeso(d.returnedCents!)})`
      : state === "held"
        ? `Holding ${formatPeso(d.collectedCents!)} (${providerLabel(d.method!)}) since ${time(d.collectedAt!)}`
        : state === "due"
          ? `${formatPeso(b.suggestedDepositCents)} to collect: they're bringing pets or messy materials`
          : "None needed so far. Collect one if they bring pets or messy materials.";

  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-lg",
          state === "returned"
            ? "bg-primary text-primary-foreground"
            : state === "not_needed"
              ? "bg-muted text-muted-foreground"
              : "bg-blush text-terracotta-ink",
        )}
        aria-hidden
      >
        {state === "returned" ? (
          <CheckIcon className="size-4" />
        ) : state === "due" ? (
          <CircleAlertIcon className="size-4" />
        ) : (
          <ShieldCheckIcon className="size-4" />
        )}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Security deposit</p>
        <p className="text-muted-foreground">{text}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(state === "due" || state === "not_needed") && (
          <CollectDepositDialog b={b} prominent={state === "due"} />
        )}
        {state === "held" && (
          <>
            <ReturnDepositDialog b={b} />
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (
                  !window.confirm(
                    "Remove this deposit? Only do this if it was recorded by mistake.",
                  )
                )
                  return;
                start(async () => {
                  handleResult(await undoSecurityDeposit({ id: b.id }), "Deposit removed.");
                });
              }}
            >
              Undo
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function CollectDepositDialog({ b, prominent }: { b: CheckInBooking; prominent: boolean }) {
  const [open, setOpen] = useState(false);
  const defaults: CollectDepositInput = {
    bookingId: b.id,
    amount: centsToPesoInput(b.suggestedDepositCents),
    method: "cash",
  };
  const form = useForm<CollectDepositInput, unknown, z.output<typeof collectDepositSchema>>({
    resolver: zodResolver(collectDepositSchema),
    defaultValues: defaults,
  });
  // Send what was typed: the server checks it again with the same schema.
  async function onSubmit() {
    if (
      handleResult(
        await collectSecurityDeposit(form.getValues()),
        "Security deposit recorded.",
        form,
      )
    )
      setOpen(false);
  }
  const busy = form.formState.isSubmitting;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
        if (next) form.reset(defaults);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant={prominent ? "default" : "outline"}>
          Collect
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>Collect the security deposit</DialogTitle>
            <DialogDescription>
              Refundable (policy 3.9): it goes back at check-out, less any cleaning or repair costs.
              It isn&apos;t part of the booking&apos;s price.
            </DialogDescription>
          </DialogHeader>
          <TextField
            control={form.control}
            name="amount"
            label="Amount"
            prefix="₱"
            inputMode="decimal"
            className="max-w-48"
          />
          <SelectField
            control={form.control}
            name="method"
            label="Paid by"
            options={[...RECORDED_PROVIDERS]}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" aria-hidden />}
              Record deposit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDepositDialog({ b }: { b: CheckInBooking }) {
  const [open, setOpen] = useState(false);
  const held = b.deposit.collectedCents ?? 0;
  const defaults: ReturnDepositInput = {
    bookingId: b.id,
    returned: centsToPesoInput(held),
    note: "",
  };
  const form = useForm<ReturnDepositInput, unknown, z.output<typeof returnDepositSchema>>({
    resolver: zodResolver(returnDepositSchema),
    defaultValues: defaults,
  });
  async function onSubmit() {
    if (
      handleResult(await returnSecurityDeposit(form.getValues()), "Deposit return recorded.", form)
    )
      setOpen(false);
  }
  const busy = form.formState.isSubmitting;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
        if (next) form.reset(defaults);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">Return</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>Return the security deposit</DialogTitle>
            <DialogDescription>
              {formatPeso(held)} was collected. Give it all back if the studio is clean and nothing
              is damaged; otherwise keep the cleaning fee or repair cost and say why.
            </DialogDescription>
          </DialogHeader>
          <TextField
            control={form.control}
            name="returned"
            label="Amount given back"
            prefix="₱"
            inputMode="decimal"
            className="max-w-48"
          />
          <TextField
            control={form.control}
            name="note"
            label="If you kept some: what for"
            placeholder="Cleaning fee"
            maxLength={200}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" aria-hidden />}
              Record return
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
