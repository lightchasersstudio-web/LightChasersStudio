import { CameraIcon } from "lucide-react";
import Link from "next/link";

import { BOOK_HREF } from "@/components/public/site-nav";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";

export function BookCta({
  title = "Ready when you are.",
  text = "Tell us about your day and we'll help you plan a session that feels like you.",
  href = BOOK_HREF,
}: {
  title?: string;
  text?: string;
  /** Booking link; pass `bookHref(slug)` on a package page so that package is chosen. */
  href?: string;
}) {
  return (
    <section aria-labelledby="book-cta" className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-panel px-6 py-14 text-center text-panel-foreground sm:px-12">
        <div className="pointer-events-none absolute -top-16 -left-16 size-64 rounded-full bg-terracotta/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -bottom-20 size-72 rounded-full bg-sage/30 blur-3xl" />
        <Sparkle className="absolute top-8 right-10 size-6 text-terracotta" />
        <Sparkle className="absolute bottom-10 left-10 size-4 text-sage" />
        <div className="relative mx-auto max-w-xl">
          <CameraIcon className="mx-auto size-10" strokeWidth={1.5} aria-hidden />
          <h2 id="book-cta" className="mt-4 text-3xl font-semibold sm:text-4xl">
            {title}
          </h2>
          <p className="mt-3 text-lg text-panel-foreground/90">{text}</p>
          <Button
            asChild
            size="lg"
            className="mt-8 bg-panel-foreground text-panel hover:bg-panel-foreground/90"
          >
            <Link href={href}>Book now</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
