import {
  BackpackIcon,
  CalendarCheckIcon,
  HeartHandshakeIcon,
  LightbulbIcon,
  ShirtIcon,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SectionHeading } from "@/components/public/section-heading";
import { bookHref } from "@/components/public/site-nav";
import { MessengerIcon } from "@/components/shared/messenger-icon";
import { Reveal, RevealItem, RevealList } from "@/components/shared/reveal";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import { CATEGORY_PREP, GENERAL_PREP } from "@/content/prepare";
import { SERVICE_CATEGORIES } from "@/lib/catalog";
import { messengerUrl } from "@/lib/utils/social";
import { getPublicSettings } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "How to prepare for your shoot",
  description:
    "What to wear, what to bring and how to get ready for your photo session with Light Chasers Studio in Zamboanga City.",
};

const ICONS: Record<string, LucideIcon> = {
  before: LightbulbIcon,
  wear: ShirtIcon,
  bring: BackpackIcon,
  day: CalendarCheckIcon,
};

export default async function PreparePage() {
  const settings = await getPublicSettings();
  const messenger = messengerUrl(settings.facebook_url);
  const categories = SERVICE_CATEGORIES.filter((c) => CATEGORY_PREP[c.value]?.length);

  return (
    <>
      <section className="bg-studio">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20">
          <SectionHeading
            as="h1"
            eyebrow="get camera-ready"
            title="How to prepare for your shoot"
            description="A few simple tips so you feel relaxed, look your best and love your photos."
          />
          <nav aria-label="Sections" className="mt-8 flex flex-wrap gap-2">
            {[...GENERAL_PREP, { id: "by-shoot", title: "By kind of shoot" }].map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:border-terracotta hover:bg-accent"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-4 py-16 sm:px-6">
        {GENERAL_PREP.map((section) => {
          const Icon = ICONS[section.id] ?? LightbulbIcon;
          return (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-heading`}
              className="scroll-mt-32"
            >
              <Reveal>
                <h2
                  id={`${section.id}-heading`}
                  className="topic-heading flex items-center gap-3 text-2xl font-semibold sm:text-3xl"
                >
                  <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {section.title}
                </h2>
              </Reveal>
              <RevealList className="mt-6 grid gap-4 sm:grid-cols-2">
                {section.tips.map((tip) => (
                  <RevealItem
                    key={tip.title}
                    className="rounded-3xl border bg-card p-5 transition-shadow duration-300 hover:shadow-md"
                  >
                    <h3 className="font-heading text-lg font-semibold">{tip.title}</h3>
                    <p className="mt-1.5 text-muted-foreground">{tip.body}</p>
                  </RevealItem>
                ))}
              </RevealList>
            </section>
          );
        })}

        <section id="by-shoot" aria-labelledby="by-shoot-heading" className="scroll-mt-32">
          <Reveal>
            <h2
              id="by-shoot-heading"
              className="topic-heading flex items-center gap-3 text-2xl font-semibold sm:text-3xl"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
                <HeartHandshakeIcon className="size-5" aria-hidden />
              </span>
              By kind of shoot
            </h2>
          </Reveal>
          <RevealList className="mt-6 grid gap-4 md:grid-cols-2">
            {categories.map((c) => (
              <RevealItem key={c.value} className="rounded-3xl border bg-card p-5">
                <p className="font-script text-2xl text-terracotta-ink">{c.label}</p>
                <ul className="mt-3 space-y-3">
                  {CATEGORY_PREP[c.value]!.map((tip) => (
                    <li key={tip.title}>
                      <h3 className="font-semibold">{tip.title}</h3>
                      <p className="text-sm text-muted-foreground">{tip.body}</p>
                    </li>
                  ))}
                </ul>
              </RevealItem>
            ))}
          </RevealList>
        </section>

        <Reveal>
          <section
            aria-labelledby="prepare-help"
            className="relative overflow-hidden rounded-[2rem] bg-panel p-8 text-center text-panel-foreground sm:p-10"
          >
            <div className="pointer-events-none absolute -top-16 -right-16 size-56 animate-float rounded-full bg-terracotta/30 blur-3xl" />
            <Sparkle className="absolute top-7 left-8 size-5 animate-twinkle text-terracotta" />
            <div className="relative">
              <h2 id="prepare-help" className="text-2xl font-semibold sm:text-3xl">
                Not sure about something?
              </h2>
              <p className="mt-2 text-panel-foreground/90">
                Send us your outfit ideas or questions. We&apos;re happy to help.
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
                  <Link href={bookHref()}>Book a session</Link>
                </Button>
              </div>
            </div>
          </section>
        </Reveal>
      </div>
    </>
  );
}
