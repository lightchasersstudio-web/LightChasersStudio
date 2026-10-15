import type { Metadata } from "next";

import { Sparkle } from "@/components/shared/sparkle";
import { BookCta } from "@/components/public/book-cta";
import { SectionHeading } from "@/components/public/section-heading";
import { ServiceCard } from "@/components/public/service-card";
import { SERVICE_CATEGORIES } from "@/lib/catalog";
import { listActiveServices } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Services & packages",
  description:
    "Wedding, prenup, portrait, family, event and product photography packages in Zamboanga City, with clear prices.",
};

export default async function ServicesPage() {
  const services = await listActiveServices();
  const groups = SERVICE_CATEGORIES.map((c) => ({
    ...c,
    services: services.filter((s) => s.category === c.value),
  })).filter((g) => g.services.length > 0 || g.comingSoon);

  return (
    <>
      <section className="bg-studio">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <SectionHeading
            as="h1"
            eyebrow="what we offer"
            title="Services & packages"
            description="Every package lists its price and what's included. A deposit holds your date when you book."
          />
          {groups.length > 1 && (
            <nav aria-label="Categories" className="mt-8 flex flex-wrap gap-2">
              {groups.map((g) => (
                <a
                  key={g.value}
                  href={`#${g.value}`}
                  className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm font-semibold transition-colors hover:border-terracotta hover:bg-accent"
                >
                  {g.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-16 sm:px-6">
        {services.length === 0 && (
          <p className="rounded-3xl border border-dashed p-10 text-center text-lg text-muted-foreground">
            New packages are on their way. Get in touch and we&apos;ll put something together for
            you.
          </p>
        )}
        {groups.map((g) => (
          <section
            key={g.value}
            id={g.value}
            aria-labelledby={`${g.value}-heading`}
            className="scroll-mt-24"
          >
            <h2 id={`${g.value}-heading`} className="text-3xl font-semibold">
              {g.label}
            </h2>
            {g.services.length > 0 ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {g.services.map((s) => (
                  <ServiceCard key={s.id} service={s} />
                ))}
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-start gap-3 rounded-3xl border border-dashed bg-accent/40 p-8 sm:flex-row sm:items-center">
                <Sparkle className="size-6 shrink-0 text-terracotta" />
                <div>
                  <p className="font-script text-2xl text-terracotta-ink">Coming soon</p>
                  <p className="text-muted-foreground">{g.label} packages will appear here soon.</p>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      <BookCta
        title="Not sure which one?"
        text="Message us with your date and idea. We'll recommend the right package."
      />
    </>
  );
}
