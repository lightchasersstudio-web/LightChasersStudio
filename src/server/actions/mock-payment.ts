"use server";

import { paymentsMockEnabled } from "@/lib/payments/mock";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";
import { getMockCheckout, mockPaySchema } from "@/server/queries/mock-checkout";
import { settlePaidEvent } from "@/server/settle-payment";

/**
 * "Pays" a pretend checkout: settles the booking exactly as the verified
 * PayMongo webhook would (same function), so the admin side shows the real result.
 */
export async function mockPay(input: unknown): Promise<ActionResult<{ redirectUrl: string }>> {
  if (!paymentsMockEnabled()) return fail("Trial payments are turned off.");
  const parsed = mockPaySchema.safeParse(input);
  if (!parsed.success) return fail("Invalid checkout.");
  const checkout = await getMockCheckout(parsed.data);
  if (!checkout) return fail("This checkout wasn't found.");

  const id = crypto.randomUUID().replaceAll("-", "");
  const result = await settlePaidEvent(
    {
      eventId: `mock_evt_${id}`,
      livemode: false,
      checkoutId: parsed.data.checkoutId,
      reference: parsed.data.reference,
      paymentId: `mock_pay_${id}`,
      amountCents: checkout.amountCents,
    },
    { mock: true, reference: parsed.data.reference },
  );
  if (result === "error") return fail("The trial payment couldn't be recorded. Try again.");
  return ok({ redirectUrl: `/book/done?ref=${parsed.data.reference}` });
}
