import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { BookCta } from "@/components/public/book-cta";
import { BrandLogo } from "@/components/public/brand-logo";
import { CATEGORY_ICONS } from "@/components/public/category-icons";
import { HeroDeck } from "@/components/public/hero-deck";
import { PhotoPolaroid } from "@/components/public/photo-polaroid";
import { SectionHeading } from "@/components/public/section-heading";
import { ServiceCard } from "@/components/public/service-card";
import { BOOK_HREF } from "@/components/public/site-nav";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import { SERVICE_CATEGORIES } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { getPublicSettings, listActiveServices, listFeaturedPhotos } from "@/server/queries/public";

export default async function HomePage() {
  const [settings, services, featured] = await Promise.all([
    getPublicSettings(),
    listActiveServices(),
    listFeaturedPhotos(9),
  ]);
  const heroPhotos = featured.slice(0, 3);
  // One card per category (Versa Space is the studio rental one); categories without
  // packages yet point to the contact page instead of an empty section.
  const shootCards = SERVICE_CATEGORIES.map(({ value, label }) => ({
    key: value,
    label,
    href: services.some((s) => s.category === value) ? `/services#${value}` : "/contact",
    Icon: CATEGORY_ICONS[value],
  }));
  const highlights = featured.slice(3, 9).length >= 3 ? featured.slice(3, 9) : featured.slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="overflow-hidden bg-studio">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-20 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-20 md:pb-28">
          <div className="animate-in duration-700 fill-mode-both fade-in slide-in-from-bottom-4">
            <p className="flex items-center gap-2 font-script text-2xl text-terracotta-ink">
              <Sparkle className="size-3.5 text-terracotta" />
              photography in {settings.city}
            </p>
            <h1 className="mt-2 text-5xl leading-[1.05] font-semibold sm:text-6xl lg:text-7xl">
              {settings.business_name}
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground sm:text-xl">
              {settings.tagline ? `${settings.tagline} ` : ""}
              Weddings &amp; prenups, portraits &amp; family, events and product shoots.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={BOOK_HREF}>Book now</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/portfolio">
                  See our work
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto flex w-full max-w-md flex-col items-center py-6 md:max-w-none">
            <Sparkle className="absolute top-0 right-6 size-6 text-terracotta" />
            <Sparkle className="absolute bottom-16 left-4 size-4 text-sage" />
            <HeroDeck photos={heroPhotos} />
          </div>
        </div>
      </section>

      {/* What we shoot */}
      <section aria-labelledby="what-we-shoot" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          id="what-we-shoot"
          eyebrow="what we shoot"
          title="Every kind of story"
          align="center"
        />
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {shootCards.map(({ key, label, href, Icon }, i) => {
            // Odd count: the last card spans the full row on 2-column screens.
            const isOrphan = shootCards.length % 2 === 1 && i === shootCards.length - 1;
            return (
              <li key={key} className={cn(isOrphan && "col-span-2 lg:col-span-1")}>
                <Link
                  href={href}
                  className="group flex h-full flex-col items-center gap-3 rounded-3xl border bg-card p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-terracotta hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-7"
                >
                  <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground transition-colors group-hover:bg-terracotta group-hover:text-white">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="font-heading text-lg leading-tight font-semibold">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Highlights */}
      {highlights.length > 0 && (
        <section aria-labelledby="highlights" className="bg-accent/50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                id="highlights"
                eyebrow="recent favourites"
                title="From the gallery"
              />
              <Button asChild variant="outline">
                <Link href="/portfolio">
                  View portfolio
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
              {highlights.map((photo, i) => (
                <li
                  key={photo.id}
                  className={cn(
                    i % 2 ? "rotate-1" : "-rotate-1",
                    "transition-transform duration-300 hover:rotate-0",
                  )}
                >
                  <PhotoPolaroid
                    photo={photo}
                    caption={photo.caption}
                    sizes="(min-width: 1024px) 33vw, 50vw"
                    className="pb-8"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Services */}
      {services.length > 0 && (
        <section aria-labelledby="packages" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              id="packages"
              eyebrow="packages"
              title="Sessions clients love"
              description="Clear prices and what's included, up front."
            />
            <Button asChild variant="outline">
              <Link href="/services">
                All services
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 3).map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </section>
      )}

      {/* About */}
      {settings.about && (
        <section aria-labelledby="about-us" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grid items-center gap-10 rounded-[2rem] border bg-card p-6 sm:p-10 md:grid-cols-[auto_1fr]">
            <div className="mx-auto -rotate-3">
              <div className="polaroid pb-9">
                <BrandLogo
                  logoPath={settings.logo_path}
                  name={settings.business_name}
                  size={180}
                  className="rounded-none p-0 shadow-none ring-0"
                />
                <p className="absolute inset-x-0 bottom-2 text-center font-script text-lg">
                  nice to meet you!
                </p>
              </div>
            </div>
            <div>
              <SectionHeading id="about-us" eyebrow="hello there" title="Behind the lens" />
              <p className="mt-4 line-clamp-5 text-lg whitespace-pre-line text-muted-foreground">
                {settings.about}
              </p>
              <Button asChild variant="link" className="mt-2 px-0 text-terracotta-ink">
                <Link href="/about">
                  Our story
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      <BookCta />
    </>
  );
}
