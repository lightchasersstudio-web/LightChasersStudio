import type { Metadata } from "next";

import { BookCta } from "@/components/public/book-cta";
import { BrandLogo } from "@/components/public/brand-logo";
import { CATEGORY_ICONS } from "@/components/public/category-icons";
import { PhotoPolaroid, PlaceholderPolaroid } from "@/components/public/photo-polaroid";
import { SectionHeading } from "@/components/public/section-heading";
import { Sparkle } from "@/components/shared/sparkle";
import { SERVICE_CATEGORIES } from "@/lib/catalog";
import { getPublicSettings, listFeaturedPhotos } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "About",
  description: "Meet Light Chasers Studio, a photography studio in Zamboanga City.",
};

export default async function AboutPage() {
  const [s, photos] = await Promise.all([getPublicSettings(), listFeaturedPhotos(2)]);

  return (
    <>
      <section className="bg-studio">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <SectionHeading as="h1" eyebrow="hello there" title={`About ${s.business_name}`} />
            {s.about ? (
              <p className="mt-6 text-lg leading-relaxed whitespace-pre-line text-muted-foreground">
                {s.about}
              </p>
            ) : (
              <p className="mt-6 text-lg text-muted-foreground">
                A photography studio in {s.city}, capturing weddings, portraits, events and
                products.
              </p>
            )}
          </div>
          <div className="relative mx-auto grid w-full max-w-sm [grid-template-areas:'stack']">
            <div className="z-10 w-3/5 -rotate-3 justify-self-start [grid-area:stack]">
              <div className="polaroid pb-9">
                <BrandLogo
                  logoPath={s.logo_path}
                  name={s.business_name}
                  size={220}
                  className="rounded-none p-0 shadow-none ring-0"
                />
                <p className="absolute inset-x-0 bottom-2 text-center font-script text-lg">
                  that&apos;s us!
                </p>
              </div>
            </div>
            {photos[0] ? (
              <PhotoPolaroid
                photo={photos[0]}
                caption={photos[0].caption}
                sizes="(min-width: 768px) 220px, 55vw"
                className="mt-24 w-3/5 rotate-6 justify-self-end [grid-area:stack]"
              />
            ) : (
              <PlaceholderPolaroid
                index={0}
                className="mt-24 w-3/5 rotate-6 justify-self-end [grid-area:stack]"
              />
            )}
            <Sparkle className="absolute -top-2 right-6 size-6 animate-twinkle text-terracotta" />
          </div>
        </div>
      </section>

      <section aria-labelledby="we-shoot" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          id="we-shoot"
          eyebrow="what we love"
          title="The moments we chase"
          align="center"
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {SERVICE_CATEGORIES.map(({ value, label }) => {
            const Icon = CATEGORY_ICONS[value];
            return (
              <li
                key={value}
                className="group flex items-center gap-4 rounded-3xl border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-terracotta/40 hover:shadow-md"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="font-heading text-xl font-semibold">{label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <BookCta />
    </>
  );
}
