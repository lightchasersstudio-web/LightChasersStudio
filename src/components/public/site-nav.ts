export const SITE_NAV = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export const BOOK_HREF = "/book";

/** The booking wizard, with a package already chosen when given its slug. */
export function bookHref(serviceSlug?: string): string {
  return serviceSlug ? `${BOOK_HREF}?service=${encodeURIComponent(serviceSlug)}` : BOOK_HREF;
}
