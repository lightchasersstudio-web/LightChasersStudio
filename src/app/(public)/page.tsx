import { ArrowRightIcon, CalendarCheckIcon, CameraIcon, WalletIcon } from "lucide-react";
import Link from "next/link";

import { BeforeAfterSection } from "@/components/public/before-after-section";
import { BookCta } from "@/components/public/book-cta";
import { BrandLogo } from "@/components/public/brand-logo";
import { CATEGORY_ICONS } from "@/components/public/category-icons";
import { HeroDeck } from "@/components/public/hero-deck";
import { PhotoPolaroid } from "@/components/public/photo-polaroid";
import { PhotoStories, type Story } from "@/components/public/photo-stories";
import { ReviewsSection } from "@/components/public/reviews-section";
import { SectionHeading } from "@/components/public/section-heading";
import { ServiceCard } from "@/components/public/service-card";
import { BOOK_HREF } from "@/components/public/site-nav";
import { Reveal, RevealItem, RevealList } from "@/components/shared/reveal";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import { SERVICE_CATEGORIES } from "@/lib/catalog";
import { publicImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  getPublicSettings,
  listActiveServices,
  listFeaturedPhotos,
  listPortfolio,
} from "@/server/queries/public";

const HOW_IT_WORKS = [
  {
    title: "Pick a package",
    text: "Browse clear prices and what's included, then choose the session that fits.",
    Icon: CameraIcon,
  },
  {
    title: "Choose your date",
    text: "See open days and times live, and pick the one that works for you.",
    Icon: CalendarCheckIcon,
  },
  {
    title: "Pay a small deposit",
    text: "Hold your slot with GCash or card. We'll confirm and get in touch.",
    Icon: WalletIcon,
  },
];

export default async function HomePage() {
  const [settings, services, featured, portfolio] = await Promise.all([
    getPublicSettings(),
    listActiveServices(),
    listFeaturedPhotos(9),
    listPortfolio(),
  ]);
  // One highlight reel per kind of shoot, newest-first up to 8 photos each.
  const stories: Story[] = SERVICE_CATEGORIES.flatMap(({ value, label }) => {
    const photos = portfolio.filter((p) => p.category === value).slice(0, 8);
    return photos.length
      ? [
          {
            id: value,
            label,
            href: `/services#${value}`,
            photos: photos.map((p) => ({
              id: p.id,
              src: publicImageUrl("portfolio", p.storage_path),
              alt: p.alt_text,
              caption: p.caption,
              blur: p.blur_data_url,
            })),
          },
        ]
      : [];
  });
  const heroPhotos = featured.slice(0, 3);
  // One card per category (Versa Space is the studio rental one). A category without
  // packages shows "Coming soon" if flagged, otherwise points to the contact page.
  const shootCards = SERVICE_CATEGORIES.map(({ value, label, comingSoon }) => {
    const empty = !services.some((s) => s.category === value);
    return {
      key: value,
      label,
      href: empty && !comingSoon ? "/contact" : `/services#${value}`,
      soon: empty && comingSoon,
      Icon: CATEGORY_ICONS[value],
    };
  });
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
            <Sparkle className="absolute top-0 right-6 size-6 animate-twinkle text-terracotta" />
            <Sparkle className="absolute bottom-16 left-4 size-4 animate-twinkle text-sage [animation-delay:1.4s]" />
            <HeroDeck photos={heroPhotos} />
          </div>
        </div>
      </section>

      {/* Highlight reels */}
      {stories.length > 0 && (
        <section aria-labelledby="stories" className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
          <h2 id="stories" className="mb-4 text-center font-script text-2xl text-terracotta-ink">
            tap to watch our highlights
          </h2>
          <PhotoStories stories={stories} />
        </section>
      )}

      {/* What we shoot */}
      <section aria-labelledby="what-we-shoot" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <SectionHeading
            id="what-we-shoot"
            eyebrow="what we shoot"
            title="Every kind of story"
            align="center"
          />
        </Reveal>
        <RevealList className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {shootCards.map(({ key, label, href, soon, Icon }, i) => {
            // Odd count: the last card spans the full row on 2-column screens.
            const isOrphan = shootCards.length % 2 === 1 && i === shootCards.length - 1;
            return (
              <RevealItem key={key} className={cn(isOrphan && "col-span-2 lg:col-span-1")}>
                <Link
                  href={href}
                  className="group flex h-full flex-col items-center gap-3 rounded-3xl border bg-card p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-terracotta hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-7"
                >
                  <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-terracotta group-hover:text-white">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="font-heading text-lg leading-tight font-semibold">{label}</span>
                  {soon && (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 font-script text-base text-terracotta-ink">
                      Coming soon
                    </span>
                  )}
                </Link>
              </RevealItem>
            );
          })}
        </RevealList>
      </section>

      {/* Highlights */}
      {highlights.length > 0 && (
        <section aria-labelledby="highlights" className="bg-accent/50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="flex flex-wrap items-end justify-between gap-4">
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
            </Reveal>
            <RevealList
              className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3"
              stagger={0.1}
            >
              {highlights.map((photo, i) => (
                <RevealItem key={photo.id}>
                  <div
                    className={cn(
                      i % 2 ? "rotate-1" : "-rotate-1",
                      "transition-transform duration-300 hover:-translate-y-1 hover:rotate-0",
                    )}
                  >
                    <PhotoPolaroid
                      photo={photo}
                      caption={photo.caption}
                      sizes="(min-width: 1024px) 33vw, 50vw"
                      className="pb-8"
                    />
                  </div>
                </RevealItem>
              ))}
            </RevealList>
          </div>
        </section>
      )}

      <BeforeAfterSection samplePhoto={featured[0]} />

      {/* Services */}
      {services.length > 0 && (
        <section aria-labelledby="packages" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
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
          </Reveal>
          <RevealList className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 3).map((s) => (
              <RevealItem key={s.id} className="flex">
                <ServiceCard service={s} />
              </RevealItem>
            ))}
          </RevealList>
        </section>
      )}

      {/* How booking works */}
      <section aria-labelledby="how-it-works" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <Reveal>
          <SectionHeading
            id="how-it-works"
            eyebrow="easy as 1, 2, 3"
            title="How booking works"
            align="center"
          />
        </Reveal>
        <div className="relative mt-10">
          {/* Dashed line joining the steps on wide screens. */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-14 right-[16%] left-[16%] hidden border-t-2 border-dashed border-terracotta/40 md:block"
          />
          <RevealList className="relative grid gap-4 md:grid-cols-3" stagger={0.12}>
            {HOW_IT_WORKS.map(({ title, text, Icon }, i) => (
              <RevealItem key={title}>
                <div className="flex h-full flex-col items-center rounded-3xl border bg-card p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <span className="relative grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
                    <Icon className="size-7" aria-hidden />
                    <span className="absolute -top-1 -right-1 grid size-7 place-items-center rounded-full bg-terracotta font-heading text-sm font-semibold text-white ring-4 ring-card">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                  <p className="mt-2 text-muted-foreground">{text}</p>
                </div>
              </RevealItem>
            ))}
          </RevealList>
        </div>
        <Reveal className="mt-8 text-center">
          <Button asChild variant="link" className="text-terracotta-ink">
            <Link href="/faq">
              Questions about deposits or payment? Read our FAQ
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        </Reveal>
      </section>

      <ReviewsSection className="pt-0" />

      {/* About */}
      {settings.about && (
        <section aria-labelledby="about-us" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <Reveal className="grid items-center gap-10 rounded-[2rem] border bg-card p-6 sm:p-10 md:grid-cols-[auto_1fr]">
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
          </Reveal>
        </section>
      )}

      <BookCta />
    </>
  );
}
