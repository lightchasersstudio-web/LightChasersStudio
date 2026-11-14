import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CircleHelpIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  HistoryIcon,
  IdCardIcon,
  CameraIcon,
  ChartColumnIcon,
  ImagesIcon,
  LayoutDashboardIcon,
  MessageSquareQuoteIcon,
  SettingsIcon,
  UserRoundIcon,
  UsersRoundIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = { href: string; label: string; icon: LucideIcon };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

/** The sidebar, in groups so staff find their part (bookings, team, website) quickly. */
export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Bookings",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
      { href: "/admin/today", label: "Today", icon: ClipboardCheckIcon },
      { href: "/admin/calendar", label: "Calendar", icon: CalendarDaysIcon },
      { href: "/admin/bookings", label: "Bookings", icon: ClipboardListIcon },
      { href: "/admin/clients", label: "Clients", icon: UsersRoundIcon },
      { href: "/admin/reports", label: "Sales report", icon: ChartColumnIcon },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/admin/employees", label: "Employees", icon: IdCardIcon },
      { href: "/admin/payroll", label: "Payroll", icon: WalletIcon },
    ],
  },
  {
    label: "Website",
    items: [
      { href: "/admin/services", label: "Services", icon: CameraIcon },
      { href: "/admin/availability", label: "Availability", icon: CalendarClockIcon },
      { href: "/admin/portfolio", label: "Portfolio", icon: ImagesIcon },
      { href: "/admin/reviews", label: "Reviews", icon: MessageSquareQuoteIcon },
      { href: "/admin/faq", label: "FAQ", icon: CircleHelpIcon },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin/activity", label: "Activity", icon: HistoryIcon },
      { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
      { href: "/admin/account", label: "Account", icon: UserRoundIcon },
    ],
  },
];
