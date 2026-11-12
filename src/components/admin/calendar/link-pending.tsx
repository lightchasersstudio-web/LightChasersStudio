"use client";

import { Loader2Icon } from "lucide-react";
import { useLinkStatus } from "next/link";

/** Inside a <Link>: its icon, swapped for a spinner while that link's page loads. */
export function LinkPending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2Icon className="animate-spin" aria-hidden /> : children;
}
