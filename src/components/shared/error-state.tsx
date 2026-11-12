"use client";

import { RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";

/** The friendly "something went wrong" screen behind each error.tsx. */
export function ErrorState({
  error,
  retry,
  homeHref,
  homeLabel,
}: {
  error: unknown;
  retry: () => void;
  homeHref: string;
  homeLabel: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="grid flex-1 place-items-center px-4 py-20">
      <div className="max-w-md text-center">
        <p className="flex items-center justify-center gap-2 font-script text-2xl text-terracotta-ink">
          <Sparkle className="size-3.5 text-terracotta" />
          oops, a blurry shot
        </p>
        <h1 className="mt-1 text-3xl font-semibold md:text-4xl">Something went wrong</h1>
        <p className="mt-3 text-muted-foreground">
          This page didn&apos;t load properly. Please try again; if it keeps happening, come back in
          a little while.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={() => retry()}>
            <RefreshCwIcon aria-hidden />
            Try again
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={homeHref}>{homeLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
