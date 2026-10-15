import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Loading placeholders for admin pages. Each page renders its static header at
// once and shows one of these (shaped like the real content) while the admin
// check and data load inside <Suspense>, so clicking between pages feels instant.

function Busy({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-label="Loading" className={className}>
      {children}
    </div>
  );
}

/** A card per row, e.g. services or opening hours. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Busy className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </Busy>
  );
}

/** Labelled fields in a card. */
export function FormSkeleton({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <Busy className={cn("space-y-6 rounded-3xl border bg-card p-6", className)}>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
      ))}
      <Skeleton className="ml-auto h-11 w-36 rounded-full" />
    </Busy>
  );
}

/** Photo tiles. */
export function GridSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <Busy className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: tiles }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/3] w-full rounded-2xl" />
      ))}
    </Busy>
  );
}

/** Month grid + day timeline. */
export function CalendarSkeleton() {
  return (
    <Busy className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="size-10 rounded-full" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-3xl border">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-none sm:h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    </Busy>
  );
}

/** Page header + two columns (booking detail). */
export function DetailSkeleton() {
  return (
    <Busy className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-48 w-full rounded-3xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-[1.75rem]" />
      </div>
    </Busy>
  );
}
