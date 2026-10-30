import Image from "next/image";
import { ArrowRightIcon, CalendarDaysIcon, ClockIcon, MapPinIcon, WalletIcon } from "lucide-react";
import Link from "next/link";

import { PhotoPolaroid, PlaceholderPolaroid } from "@/components/public/photo-polaroid";
import { PolaroidSlideshow } from "@/components/public/polaroid-slideshow";
import { Reveal } from "@/components/shared/reveal";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import { formatWorkshopWhen, workshopPrices } from "@/lib/booking/workshop";
import { publicImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/utils/money";
import { parseWorkshopSlides } from "@/lib/validations/workshop-slides";
import type { PublicPhoto, PublicService } from "@/server/queries/public";

/**
 * Home-page banner for the open workshop: copy and price on the left, a small
 * polaroid stack on the right: the slideshow photos picked in the admin, else the
 * workshop's cover photo and gallery photos.
 */
export function WorkshopPromo({
  workshop,
  photos,
  vatPercent,
  className,
}: {
  workshop: PublicService;
  photos: PublicPhoto[];
  vatPercent: number;
  className?: string;
}) {
  // The slideshow: the photos the admin picked for it, else the workshop's own
  // cover photo first (if any), then gallery photos. The polaroid behind shows one more.
  const chosen = parseWorkshopSlides(workshop.workshop_slides).map((s) => ({
    src: publicImageUrl("portfolio", s.path),
    blur: s.blur,
  }));
  const slides = chosen.length
    ? chosen
    : [
        ...(workshop.cover_image_path
          ? [{ src: publicImageUrl("portfolio", workshop.cover_image_path), blur: null }]
          : []),
        ...photos.map((p) => ({
          src: publicImageUrl("portfolio", p.storage_path),
          blur: p.blur_data_url,
        })),
      ];
  const back = chosen.length ? chosen.at(-1) : photos.at(-1);
  // The workshop's main (Regular) price, even while Regular is switched off
  // (owner's choice 2026-10-30); hidden when every category is off (paused).
  const priceCents = Object.values(workshopPrices(workshop)).some((c) => c !== null)
    ? workshop.price_cents
    : null;
  // The admin sets the date; until then the banner teases it.
  const when =
    workshop.workshop_starts_at && workshop.workshop_ends_at
      ? formatWorkshopWhen(workshop.workshop_starts_at, workshop.workshop_ends_at)
      : null;
  const points = [
    { text: when?.date ?? "Date to be announced soon", Icon: CalendarDaysIcon },
    ...(when ? [{ text: when.time, Icon: ClockIcon }] : []),
    ...(workshop.workshop_location ? [{ text: workshop.workshop_location, Icon: MapPinIcon }] : []),
    { text: "Pay half or the full price to save your seat", Icon: WalletIcon },
  ];
  return (
    <section
      aria-labelledby="workshop-promo"
      className={cn("mx-auto max-w-6xl px-4 pb-20 sm:px-6", className)}
    >
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
              {when ? "Now open" : "Coming soon"}
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
            {points.map(({ text, Icon }) => (
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
                {when ? "Sign up for the workshop" : "See the workshop"}
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
            {priceCents !== null && (
              <p>
                <span className="font-heading text-2xl font-semibold">
                  {formatPeso(priceCents)}
                </span>
                {vatPercent > 0 && (
                  <span className="ml-1.5 text-sm text-primary-foreground/80">+ VAT</span>
                )}
              </p>
            )}
          </div>
        </div>

        <Link
          href="/workshop"
          tabIndex={-1}
          aria-hidden
          className="relative mx-auto block w-full max-w-xs py-4 md:max-w-sm"
        >
          <div className="relative">
            {/* A second polaroid peeking out behind, for a little stack. */}
            <div className="absolute inset-0 translate-x-3 -translate-y-2 rotate-6 sm:translate-x-6 sm:-translate-y-3">
              {back && "src" in back ? (
                <BackPolaroid src={back.src} blur={back.blur} />
              ) : back ? (
                <PhotoPolaroid photo={back} sizes="20rem" className="pb-12" />
              ) : (
                <PlaceholderPolaroid index={1} className="pb-12" />
              )}
            </div>
            <div className="relative -rotate-3 transition-transform duration-500 hover:rotate-0">
              {slides.length > 0 ? (
                <PolaroidSlideshow
                  photos={slides}
                  caption="class is in session!"
                  sizes="(min-width: 768px) 24rem, 80vw"
                />
              ) : (
                <PlaceholderPolaroid index={0} className="pb-12" />
              )}
            </div>
          </div>
        </Link>
      </Reveal>
    </section>
  );
}

/** The decorative polaroid peeking out behind the slideshow. */
function BackPolaroid({ src, blur }: { src: string; blur: string | null }) {
  return (
    <figure aria-hidden className="polaroid pb-12">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2px] bg-muted">
        <Image
          src={src}
          alt=""
          fill
          sizes="20rem"
          placeholder={blur ? "blur" : "empty"}
          blurDataURL={blur ?? undefined}
          className="object-cover"
        />
      </div>
    </figure>
  );
}
