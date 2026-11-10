import { Badge } from "@/components/ui/badge";
import { categoryLabel } from "@/lib/payroll/employees";
import { cn } from "@/lib/utils";

/** Soft brand tints, always with dark text (sage/blush need it). */
const TONE: Record<string, string> = {
  events: "bg-blush text-foreground",
  photobooth: "bg-sage/30 text-foreground",
  studio: "bg-secondary text-secondary-foreground",
};

/** Events / Photobooth / Studio, or a dashed "Uncategorized" for staff without one. */
export function EmployeeCategoryBadge({
  category,
  className,
}: {
  category: string | null;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        category && TONE[category]
          ? cn("border-transparent", TONE[category])
          : "border-dashed text-muted-foreground",
        className,
      )}
    >
      {categoryLabel(category)}
    </Badge>
  );
}
