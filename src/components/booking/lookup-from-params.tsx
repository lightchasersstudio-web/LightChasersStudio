import { BookingLookup } from "@/components/booking/booking-lookup";
import { messengerUrl } from "@/lib/utils/social";
import { getPublicSettings } from "@/server/queries/public";

/** Pre-fills the reference from ?ref= (request data, so render it inside Suspense). */
export async function LookupFromParams({
  searchParams,
  mode,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  mode: "view" | "pay";
}) {
  const [{ ref, paid }, settings] = await Promise.all([searchParams, getPublicSettings()]);
  const reference = (Array.isArray(ref) ? ref[0] : ref) ?? "";
  return (
    <BookingLookup
      initialReference={reference}
      mode={mode}
      justPaid={paid === "1"}
      contact={{
        messengerHref: messengerUrl(settings.facebook_url),
        phone: settings.phone,
        email: settings.email,
      }}
    />
  );
}
