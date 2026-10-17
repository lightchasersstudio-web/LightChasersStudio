/**
 * Trial mode: pretend PayMongo and Resend are set up so the whole booking →
 * payment → admin flow can be tried locally. A fake checkout page stands in for
 * PayMongo and emails are saved for preview instead of sent.
 * Never on for the live Vercel site, so nobody can "pay" for free there.
 */
export function paymentsMockEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.PAYMENTS_MOCK === "true" && env.VERCEL_ENV !== "production";
}
