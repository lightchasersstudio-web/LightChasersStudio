import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CameraIcon,
  ChartColumnIcon,
  ImagesIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = { href: string; label: string; icon: LucideIcon };

// Add sections here as each phase ships (bookings table and clients in Phase 6).
export const adminNav: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDaysIcon },
  { href: "/admin/reports", label: "Sales report", icon: ChartColumnIcon },
  { href: "/admin/services", label: "Services", icon: CameraIcon },
  { href: "/admin/availability", label: "Availability", icon: CalendarClockIcon },
  { href: "/admin/portfolio", label: "Portfolio", icon: ImagesIcon },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
  { href: "/admin/account", label: "Account", icon: UserRoundIcon },
];
