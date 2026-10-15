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
