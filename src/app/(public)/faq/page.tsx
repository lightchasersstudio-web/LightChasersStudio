import { ArrowRightIcon, ChevronDownIcon, MailIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SectionHeading } from "@/components/public/section-heading";
import { MessengerIcon } from "@/components/shared/messenger-icon";
import { Reveal } from "@/components/shared/reveal";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import { visibleFaq, type FaqItem } from "@/content/faq";
import { messengerUrl } from "@/lib/utils/social";
import { getPublicSettings } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Questions & answers",
  description:
    "How booking, deposits and payment work at Light Chasers Studio, a photography studio in Zamboanga City.",
};

const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default async function FaqPage() {
  const settings = await getPublicSettings();
  const groups = visibleFaq(settings);
  const messenger = messengerUrl(settings.facebook_url);

  // FAQ rich results for search engines (published answers only).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups
      .flatMap((g) => g.items)
      .filter((i) => !i.draft)
      .map((i) => ({
        "@type": "Question",
        name: i.question,
        acceptedAnswer: { "@type": "Answer", text: i.answer },
      })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so the JSON can't close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <section className="bg-studio">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
          <SectionHeading
            as="h1"
            eyebrow="good to know"
            title="Questions & answers"
            description="How booking, deposits and payment work. Can't find your answer? Send us a message."
          />
          {groups.length > 1 && (
            <nav aria-label="Topics" className="mt-8 flex flex-wrap gap-2">
              {groups.map((g) => (
                <a
                  key={g.title}
                  href={`#${slug(g.title)}`}
                  className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:border-terracotta hover:bg-accent"
                >
                  {g.title}
                </a>
              ))}
            </nav>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-12 px-4 py-16 sm:px-6">
        {groups.map((g) => (
          <Reveal key={g.title}>
            <section
              id={slug(g.title)}
              aria-labelledby={`${slug(g.title)}-heading`}
              className="scroll-mt-24"
            >
              <h2 id={`${slug(g.title)}-heading`} className="text-2xl font-semibold sm:text-3xl">
                {g.title}
              </h2>
              <div className="mt-5 space-y-3">
                {g.items.map((item) => (
                  <Question key={item.question} item={item} />
                ))}
              </div>
            </section>
          </Reveal>
        ))}

        <Reveal>
          <section
            aria-labelledby="still-asking"
            className="relative overflow-hidden rounded-[2rem] bg-panel p-8 text-center text-panel-foreground sm:p-10"
          >
            <div className="pointer-events-none absolute -top-16 -right-16 size-56 animate-float rounded-full bg-terracotta/30 blur-3xl" />
            <Sparkle className="absolute top-7 left-8 size-5 animate-twinkle text-terracotta" />
            <div className="relative">
              <h2 id="still-asking" className="text-2xl font-semibold sm:text-3xl">
                Still have a question?
              </h2>
              <p className="mt-2 text-panel-foreground/90">
                We&apos;re happy to help you plan your shoot.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {messenger && (
                  <Button
                    asChild
                    size="lg"
                    className="bg-panel-foreground text-panel hover:bg-panel-foreground/90"
                  >
                    <a href={messenger} target="_blank" rel="noopener noreferrer">
                      <MessengerIcon className="size-5" />
                      Message us
                      <span className="sr-only"> on Messenger (opens in a new tab)</span>
                    </a>
                  </Button>
                )}
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-panel-foreground/30 bg-transparent text-panel-foreground hover:bg-panel-foreground/10 hover:text-panel-foreground"
                >
                  <Link href="/contact">
                    <MailIcon aria-hidden />
                    Contact page
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </Reveal>
      </div>
    </>
  );
}

function Question({ item }: { item: FaqItem }) {
  return (
    <details
      name="faq"
      className="faq group rounded-2xl border bg-card transition-shadow duration-300 open:shadow-md"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 font-semibold transition-colors hover:text-terracotta-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-2">
          {item.question}
          {item.draft && (
            <span className="rounded-full border border-dashed border-terracotta/60 bg-blush/60 px-2 py-0.5 text-xs font-bold text-terracotta-ink">
              Needs your answer (hidden on live site)
            </span>
          )}
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition-transform duration-300 group-open:rotate-180">
          <ChevronDownIcon className="size-4" aria-hidden />
        </span>
      </summary>
      <div className="px-5 pb-5 text-muted-foreground">
        <p className={item.draft ? "italic" : undefined}>{item.answer}</p>
        {item.link && (
          <Button asChild variant="link" className="mt-1 h-auto px-0 text-terracotta-ink">
            <Link href={item.link.href}>
              {item.link.label}
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        )}
      </div>
    </details>
  );
}
