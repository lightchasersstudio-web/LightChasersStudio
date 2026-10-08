const ADMIN_HOME = "/admin";

/**
 * Sanitises a post-login `next` parameter: only same-site paths under /admin
 * are allowed, so the login page can't be used as an open redirect.
 */
export function safeAdminRedirect(next: string | null | undefined): string {
  if (!next) return ADMIN_HOME;

  // Reject protocol-relative ("//evil.com"), backslash tricks and absolute URLs.
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return ADMIN_HOME;

  let url: URL;
  try {
    url = new URL(next, "http://localhost");
  } catch {
    return ADMIN_HOME;
  }
  if (url.origin !== "http://localhost") return ADMIN_HOME;

  const isAdminPath = url.pathname === ADMIN_HOME || url.pathname.startsWith(`${ADMIN_HOME}/`);
  if (!isAdminPath || url.pathname === "/admin/login") return ADMIN_HOME;

  return `${url.pathname}${url.search}`;
}
