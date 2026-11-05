import {
  CalendarClockIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  HistoryIcon,
  CameraIcon,
  ChartColumnIcon,
  ImagesIcon,
  LayoutDashboardIcon,
  MessageSquareQuoteIcon,
  SettingsIcon,
  UserRoundIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = { href: string; label: string; icon: LucideIcon };

export const adminNav: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDaysIcon },
  { href: "/admin/bookings", label: "Bookings", icon: ClipboardListIcon },
  { href: "/admin/clients", label: "Clients", icon: UsersRoundIcon },
  { href: "/admin/reports", label: "Sales report", icon: ChartColumnIcon },
  { href: "/admin/services", label: "Services", icon: CameraIcon },
  { href: "/admin/availability", label: "Availability", icon: CalendarClockIcon },
  { href: "/admin/portfolio", label: "Portfolio", icon: ImagesIcon },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquareQuoteIcon },
  { href: "/admin/activity", label: "Activity", icon: HistoryIcon },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
  { href: "/admin/account", label: "Account", icon: UserRoundIcon },
];
