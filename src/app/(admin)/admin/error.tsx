"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} homeHref="/admin" homeLabel="Dashboard" />;
}
