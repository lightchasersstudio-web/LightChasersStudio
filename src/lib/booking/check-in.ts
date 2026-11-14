// Shoot-day check-in (owner request 2026-11-14, Studio Policy 1.3, 2.3, 2.5,
// 3.9): what staff tick off when the renter arrives and leaves, and the
// refundable security deposit for messy materials or pets.

export const CHECK_IN_STEPS = [
  {
    step: "id",
    column: "id_checked_at",
    label: "ID checked",
    hint: "The renter showed a valid ID (policy 2.5). Under 18: a parent or guardian signs.",
  },
  {
    step: "inspect_in",
    column: "inspected_in_at",
    label: "Check-in inspection",
    hint: "Space and equipment looked over together and signed off (policy 2.3).",
  },
  {
    step: "inspect_out",
    column: "inspected_out_at",
    label: "Check-out inspection",
    hint: "Everything left as it was received (policy 2.3, 4.1). Add any charges below.",
  },
] as const;

export type CheckInStep = (typeof CHECK_IN_STEPS)[number]["step"];
export type CheckInColumn = (typeof CHECK_IN_STEPS)[number]["column"];
export const CHECK_IN_STEP_VALUES = CHECK_IN_STEPS.map((s) => s.step) as [
  CheckInStep,
  ...CheckInStep[],
];
export const checkInColumn = (step: CheckInStep): CheckInColumn =>
  CHECK_IN_STEPS.find((s) => s.step === step)!.column;

export type SecurityDeposit = {
  /** What the booking said at booking time: pets or messy materials (policy 3.9). */
  expected: boolean;
  collectedCents: number | null;
  method: string | null;
  collectedAt: string | null;
  returnedCents: number | null;
  returnedAt: string | null;
  note: string | null;
};

export type DepositState = "not_needed" | "due" | "held" | "returned";

/** Where the security deposit stands. */
export function depositState(d: SecurityDeposit): DepositState {
  if (d.returnedAt !== null) return "returned";
  if (d.collectedCents !== null) return "held";
  return d.expected ? "due" : "not_needed";
}

/** Kept for cleaning or repairs (collected − returned), once it's been returned. */
export const depositKeptCents = (d: SecurityDeposit): number =>
  d.collectedCents !== null && d.returnedCents !== null ? d.collectedCents - d.returnedCents : 0;

/**
 * "3 of 5 done": the steps, the balance and (when there is one) the deposit.
 * Outside events and the Photobooth only have the balance.
 */
export function checkInProgress(b: {
  studio: boolean;
  steps: Record<CheckInColumn, string | null>;
  balanceCents: number;
  deposit: SecurityDeposit;
}): { done: number; total: number } {
  const balance = b.balanceCents <= 0;
  if (!b.studio) return { done: balance ? 1 : 0, total: 1 };
  const steps = CHECK_IN_STEPS.map((s) => b.steps[s.column] !== null);
  const state = depositState(b.deposit);
  const deposit = state === "not_needed" ? [] : [state === "returned"];
  const all = [...steps, balance, ...deposit];
  return { done: all.filter(Boolean).length, total: all.length };
}
