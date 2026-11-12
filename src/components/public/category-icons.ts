import {
  HeartIcon,
  HouseIcon,
  PackageIcon,
  PartyPopperIcon,
  PresentationIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import type { ServiceCategory } from "@/lib/catalog";

export const CATEGORY_ICONS: Record<ServiceCategory, LucideIcon> = {
  wedding: HeartIcon,
  portrait: UsersIcon,
  studio: HouseIcon,
  event: PartyPopperIcon,
  commercial: PackageIcon,
  workshop: PresentationIcon,
};
