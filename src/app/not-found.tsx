import { CameraOffIcon } from "lucide-react";
import Link from "next/link";

import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grid flex-1 place-items-center bg-studio px-4 py-20">
      <div className="text-center">
        <div className="polaroid mx-auto w-48 -rotate-3 pb-10">
          <div className="grid aspect-square place-items-center rounded-[2px] bg-linear-to-br from-sage/30 to-terracotta/40">
            <CameraOffIcon
              className="size-12 text-white drop-shadow"
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
          <p className="absolute inset-x-0 bottom-2 font-script text-xl">out of focus…</p>
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 font-script text-2xl text-terracotta-ink">
          <Sparkle className="size-3.5 text-terracotta" />
          404
        </p>
        <h1 className="mt-1 text-4xl font-semibold">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-muted-foreground">It may have moved, or the link has a typo.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/services">See services</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
