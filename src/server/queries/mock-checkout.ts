import "server-only";

import { z } from "zod";

import { paymentsMockEnabled } from "@/lib/payments/mock";
import { createAdminClient } from "@/lib/supabase/admin";

export const mockPaySchema = z.object({
  reference: z.string().regex(/^BK-\d{4}-[0-9A-F]{6}$/),
  checkoutId: z.string().regex(/^mock_cs_[0-9a-f]{32}$/),
});

/** Where a paid / abandoned pretend checkout returns to (balance payments go back to /booking). */
export function mockReturnUrls(reference: string, purpose: "deposit" | "balance") {
  return purpose === "balance"
    ? { done: `/booking?ref=${reference}&paid=1`, cancel: `/booking?ref=${reference}` }
    : { done: `/book/done?ref=${reference}`, cancel: `/book/cancelled?ref=${reference}` };
}

/** The pretend checkout this booking is waiting on, or null. Trial mode only. */
export async function getMockCheckout(input: unknown) {
  if (!paymentsMockEnabled()) return null;
  const parsed = mockPaySchema.safeParse(input);
  if (!parsed.success) return null;
  const { data } = await createAdminClient()
    .from("payments")
    .select(
      "amount_cents, status, purpose, booking:bookings!inner(reference_code, contact_name, service:services(name))",
    )
    .eq("provider_checkout_id", parsed.data.checkoutId)
    .eq("booking.reference_code", parsed.data.reference)
    .maybeSingle();
  if (!data?.booking) return null;
  return {
    amountCents: data.amount_cents,
    purpose: data.purpose === "balance" ? ("balance" as const) : ("deposit" as const),
    paid: data.status === "paid",
    contactName: data.booking.contact_name,
    serviceName: data.booking.service?.name ?? "Photo session",
  };
}
