import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PAGE_SIZE } from "@/lib/admin/list-filters";

/** "21–25 of 25" with previous/next links; nothing when everything fits on one page. */
export function Pager({
  page,
  total,
  href,
}: {
  page: number;
  total: number;
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages === 1) return null;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {first}–{last} of {total}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline">
            <Link href={href(page - 1)} rel="prev">
              <ChevronLeftIcon aria-hidden />
              Previous
            </Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="outline">
            <Link href={href(page + 1)} rel="next">
              Next
              <ChevronRightIcon aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}

/** Shown when a list or a search has no rows. */
export function EmptyList({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed px-4 py-12 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
