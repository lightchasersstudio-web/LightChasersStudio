import { MessengerButton } from "@/components/public/messenger-button";
import { messengerUrl } from "@/lib/utils/social";
import { getPublicSettings } from "@/server/queries/public";

/** The Messenger bubble, shown only when the studio's Facebook link is a page we can chat with. */
export async function SiteMessenger() {
  const settings = await getPublicSettings();
  const href = messengerUrl(settings.facebook_url);
  return href ? <MessengerButton href={href} businessName={settings.business_name} /> : null;
}
