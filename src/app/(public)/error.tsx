"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function PublicError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} homeHref="/" homeLabel="Back to home" />;
}
