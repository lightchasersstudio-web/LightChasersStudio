import { LayoutDashboardIcon, type LucideIcon } from "lucide-react";

export type AdminNavItem = { href: string; label: string; icon: LucideIcon };

// Add sections here as each phase ships (services, availability, portfolio, settings,
// bookings, calendar, clients).
export const adminNav: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
];
