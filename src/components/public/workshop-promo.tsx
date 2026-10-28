import { ArrowRightIcon, CalendarCheckIcon, WalletIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { PhotoPolaroid, PlaceholderPolaroid } from "@/components/public/photo-polaroid";
import { Reveal } from "@/components/shared/reveal";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import { publicImageUrl } from "@/lib/storage";
import { formatPeso } from "@/lib/utils/money";
import type { PublicPhoto, PublicService } from "@/server/queries/public";

const POINTS = [
  { text: "Pick a free date and time on our calendar", Icon: CalendarCheckIcon },
  { text: "Pay half or the full price to save your seat", Icon: WalletIcon },
];

/**
 * Home-page banner for the open workshop: copy and price on the left, a small
 * polaroid stack (the workshop's cover photo, else two gallery photos) on the right.
 */
export function WorkshopPromo({
  workshop,
  photos,
  vatPercent,
}: {
  workshop: PublicService;
  photos: PublicPhoto[];
  vatPercent: number;
}) {
  const [back, front] = photos;
  return (
    <section aria-labelledby="workshop-promo" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <Reveal className="relative grid items-center gap-10 overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground sm:p-10 md:grid-cols-[1.2fr_1fr] lg:p-14">
        {/* Soft glow + sparkles, decoration only. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-terracotta/30 blur-3xl"
        />
        <Sparkle className="absolute top-6 right-8 size-5 animate-twinkle text-terracotta" />
        <Sparkle className="absolute bottom-8 left-[45%] size-3.5 animate-twinkle text-sage [animation-delay:1.2s]" />

        <div className="relative">
          <p className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-background px-3 py-1 text-xs font-bold tracking-wide text-terracotta-ink uppercase">
              Now open
            </span>
            <span className="font-script text-2xl text-primary-foreground/85">learn with us</span>
          </p>
          <h2 id="workshop-promo" className="mt-3 text-3xl font-semibold sm:text-4xl">
            {workshop.name}
          </h2>
          <p className="mt-3 max-w-lg text-lg text-primary-foreground/85">
            {workshop.summary ??
              "Love the photos you see here? Come learn the craft with the Light Chasers team."}
          </p>
          <ul className="mt-6 space-y-3">
            {POINTS.map(({ text, Icon }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-foreground/15">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button
              asChild
              size="lg"
              className="bg-background text-foreground shadow-md hover:bg-background/90"
            >
              <Link href="/workshop">
                Sign up for the workshop
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
            <p>
              <span className="font-heading text-2xl font-semibold">
                {formatPeso(workshop.price_cents)}
              </span>
              {vatPercent > 0 && (
                <span className="ml-1.5 text-sm text-primary-foreground/80">+ VAT</span>
              )}
            </p>
          </div>
        </div>

        <Link
          href="/workshop"
          tabIndex={-1}
          aria-hidden
          className="relative mx-auto block w-full max-w-xs py-4 md:max-w-sm"
        >
          {workshop.cover_image_path ? (
            <figure className="polaroid rotate-2 pb-12 transition-transform duration-300 hover:rotate-0">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[2px] bg-muted">
                <Image
                  src={publicImageUrl("portfolio", workshop.cover_image_path)}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 24rem, 80vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="absolute inset-x-2 bottom-2.5 text-center font-script text-2xl">
                class is in session!
              </figcaption>
            </figure>
          ) : (
            <div className="relative">
              <div className="absolute inset-0 translate-x-3 -translate-y-2 rotate-6 sm:translate-x-6 sm:-translate-y-3">
                {back ? (
                  <PhotoPolaroid photo={back} sizes="20rem" className="pb-12" />
                ) : (
                  <PlaceholderPolaroid index={1} className="pb-12" />
                )}
              </div>
              <div className="relative -rotate-3 transition-transform duration-300 hover:rotate-0">
                {front ? (
                  <PhotoPolaroid
                    photo={front}
                    caption="class is in session!"
                    sizes="20rem"
                    className="pb-12"
                  />
                ) : (
                  <PlaceholderPolaroid index={0} className="pb-12" />
                )}
              </div>
            </div>
          )}
        </Link>
      </Reveal>
    </section>
  );
}
