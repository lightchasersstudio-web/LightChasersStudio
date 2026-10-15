import { STATUS_LABELS, type BookingStatus } from "@/lib/booking/status";
import { cn } from "@/lib/utils";

/** Calendar colours: sage = confirmed, blush/terracotta = needs review, dashed = awaiting payment. */
export const STATUS_TONES: Record<BookingStatus, string> = {
  confirmed: "bg-sage/30 text-foreground border-sage",
  completed: "bg-sage/20 text-foreground border-sage/60",
  pending: "bg-blush text-terracotta-ink border-terracotta",
  pending_payment: "bg-muted/60 text-muted-foreground border-dashed border-muted-foreground/60",
  cancelled: "bg-muted text-muted-foreground border-transparent",
  declined: "bg-muted text-muted-foreground border-transparent",
  expired: "bg-muted text-muted-foreground border-transparent",
};

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold",
        STATUS_TONES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
