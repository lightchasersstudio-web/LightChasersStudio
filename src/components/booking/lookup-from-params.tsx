import { BookingLookup } from "@/components/booking/booking-lookup";

/** Pre-fills the reference from ?ref= (request data, so render it inside Suspense). */
export async function LookupFromParams({
  searchParams,
  mode,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  mode: "view" | "pay";
}) {
  const { ref } = await searchParams;
  const reference = (Array.isArray(ref) ? ref[0] : ref) ?? "";
  return <BookingLookup initialReference={reference} mode={mode} />;
}
