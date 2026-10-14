export const SITE_NAV = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

// shortcut: points at the contact page until the booking wizard ships in Phase 5; then use "/book".
export const BOOK_HREF = "/contact";
