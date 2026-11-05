/** Facebook paths that aren't a page's username. */
const NOT_A_PAGE = new Set([
  "profile.php",
  "groups",
  "pages",
  "people",
  "events",
  "watch",
  "share",
]);

/** "https://www.facebook.com/<page>/" → "https://m.me/<page>" (opens a Messenger chat), else null. */
export function messengerUrl(facebookUrl: string | null): string | null {
  if (!facebookUrl) return null;
  try {
    const url = new URL(facebookUrl);
    if (!/(^|\.)facebook\.com$/i.test(url.hostname)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 1 || NOT_A_PAGE.has(parts[0]!.toLowerCase())) return null;
    return `https://m.me/${parts[0]}`;
  } catch {
    return null;
  }
}

/** A Google Maps search for the studio's address (opens the app on phones). */
export const googleMapsUrl = (place: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

/** "https://www.facebook.com/lightchasers/" → "facebook.com/lightchasers" */
export const displayUrl = (url: string) =>
  url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/**
 * A Google Maps link: google.com/maps…, maps.google.com, or the short Share links
 * (maps.app.goo.gl, goo.gl/maps, g.page).
 */
export function isGoogleMapsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      ((host === "google.com" || host.endsWith(".google.com")) &&
        (host.startsWith("maps.") || url.pathname.startsWith("/maps"))) ||
      host === "maps.app.goo.gl" ||
      (host === "goo.gl" && url.pathname.startsWith("/maps")) ||
      host === "g.page"
    );
  } catch {
    return false;
  }
}

/** Where "open the map" goes: the studio's own pin if set, else a search for the studio. */
export function studioMapsUrl(s: {
  maps_url: string | null;
  business_name: string;
  address: string | null;
  city: string;
}): string {
  return s.maps_url ?? googleMapsUrl(`${s.business_name}, ${s.address ?? s.city}`);
}
