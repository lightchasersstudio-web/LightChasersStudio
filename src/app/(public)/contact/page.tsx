import {
  ArrowUpRightIcon,
  CalendarHeartIcon,
  CheckIcon,
  ClockIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BOOK_HREF } from "@/components/public/site-nav";
import { socialLinks } from "@/components/public/site-footer";
import { FacebookIcon } from "@/components/shared/facebook-icon";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/catalog";
import { formatTime } from "@/lib/utils/format";
import { messengerUrl } from "@/lib/utils/social";
import { getOpeningHours, getPublicSettings } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Message Light Chasers Studio on Facebook, email or call us, or book a photo session online in Zamboanga City.",
};

const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

/** What helps us reply quickly (facts the studio needs, not policy). */
const MESSAGE_TIPS = [
  "Your preferred date and time",
  "The kind of shoot (wedding, portraits, event, product…)",
  "Where it will be",
  "How many people",
];

export default async function ContactPage() {
  const [s, hours] = await Promise.all([getPublicSettings(), getOpeningHours()]);
  const facebook = s.facebook_url;
  const messenger = messengerUrl(facebook);
  const otherSocials = socialLinks(s).filter((l) => l.label !== "Facebook");
  const place = s.address ?? s.city;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

  const channels = [
    s.email && {
      icon: MailIcon,
      label: "Email",
      value: s.email,
      action: "Send an email",
      href: `mailto:${s.email}`,
    },
    s.phone && {
      icon: PhoneIcon,
      label: "Call or text",
      value: s.phone,
      action: "Call us",
      href: `tel:${s.phone.replace(/[^\d+]/g, "")}`,
    },
    {
      icon: MapPinIcon,
      label: "Studio",
      value: place,
      action: "Open in Google Maps",
      href: mapsUrl,
      external: true,
    },
  ].filter(Boolean) as {
    icon: typeof MailIcon;
    label: string;
    value: string;
    action: string;
    href: string;
    external?: boolean;
  }[];

  return (
    <>
      {/* Intro + Facebook, the quickest way to reach the studio */}
      <section className="bg-studio">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="flex items-center gap-2 font-script text-2xl text-terracotta-ink">
              <Sparkle className="size-3.5 text-terracotta" />
              say hello
            </p>
            <h1 className="mt-2 text-4xl leading-tight font-semibold text-balance sm:text-5xl">
              Let&apos;s plan your session
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Book online in a couple of minutes, or send us a message with your date, the kind of
              shoot and where. We&apos;ll reply as soon as we can.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={BOOK_HREF}>
                  <CalendarHeartIcon aria-hidden />
                  Book now
                </Link>
              </Button>
              {facebook && (
                <Button asChild size="lg" variant="outline">
                  <a href={messenger ?? facebook} {...NEW_TAB}>
                    <FacebookIcon className="size-4" />
                    Message us on Facebook
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </Button>
              )}
            </div>
          </div>

          {facebook && (
            <div className="relative overflow-hidden rounded-[2rem] bg-panel p-7 text-panel-foreground shadow-xl sm:p-9">
              <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-terracotta/30 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-sage/25 blur-3xl" />
              <Sparkle className="absolute top-7 right-8 size-5 text-terracotta" />
              <div className="relative">
                <span className="grid size-14 place-items-center rounded-full bg-panel-foreground text-panel">
                  <FacebookIcon className="size-7" />
                </span>
                <h2 className="mt-5 text-2xl font-semibold sm:text-3xl">
                  Chat with us on Facebook
                </h2>
                <p className="mt-2 text-panel-foreground/90">
                  The quickest way to ask about dates, packages and anything else. You can also see
                  what we&apos;ve been up to on our page.
                </p>
                <p className="mt-4 font-semibold break-all text-panel-foreground/90">
                  {facebook.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {messenger && (
                    <Button
                      asChild
                      size="lg"
                      className="bg-panel-foreground text-panel hover:bg-panel-foreground/90"
                    >
                      <a href={messenger} {...NEW_TAB}>
                        <MessageCircleIcon aria-hidden />
                        Message us
                        <span className="sr-only">on Messenger (opens in a new tab)</span>
                      </a>
                    </Button>
                  )}
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-panel-foreground/40 bg-transparent text-panel-foreground hover:bg-panel-foreground/10 hover:text-panel-foreground"
                  >
                    <a href={facebook} {...NEW_TAB}>
                      Visit our page
                      <ArrowUpRightIcon aria-hidden />
                      <span className="sr-only">(opens Facebook in a new tab)</span>
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="more-ways" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-6">
            <h2 id="more-ways" className="text-3xl font-semibold">
              Other ways to reach us
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {channels.map(({ icon: Icon, label, value, action, href, external }) => (
                <li
                  key={label}
                  // Email + phone share a row; anything left alone takes the full width.
                  className={
                    label === "Studio" || channels.length < 3 ? "sm:col-span-2" : undefined
                  }
                >
                  <a
                    href={href}
                    {...(external ? NEW_TAB : {})}
                    className="group flex h-full items-start gap-4 rounded-3xl border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-terracotta hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition-colors group-hover:bg-terracotta group-hover:text-white">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-muted-foreground">{label}</span>
                      <span className="block font-semibold break-words">{value}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-terracotta-ink">
                        {action}
                        <ArrowUpRightIcon className="size-3.5" aria-hidden />
                      </span>
                      {external && <span className="sr-only">(opens in a new tab)</span>}
                    </span>
                  </a>
                </li>
              ))}
              {otherSocials.length > 0 && (
                <li className="sm:col-span-2">
                  <div className="rounded-3xl border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Follow along</p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {otherSocials.map(({ label, href }) => (
                        <li key={label}>
                          <a
                            href={href}
                            {...NEW_TAB}
                            className="inline-flex min-h-11 items-center gap-1 rounded-full border px-4 text-sm font-semibold transition-colors hover:border-terracotta hover:bg-accent"
                          >
                            {label}
                            <ArrowUpRightIcon className="size-3.5" aria-hidden />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              )}
            </ul>

            <div className="rounded-3xl border border-dashed bg-accent/40 p-6">
              <h3 className="text-xl font-semibold">Help us reply faster</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                When you message us, it helps to include:
              </p>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {MESSAGE_TIPS.map((tip) => (
                  <li key={tip} className="flex gap-2.5">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                      <CheckIcon className="size-3" aria-hidden />
                    </span>
                    <span className="text-sm">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <section aria-labelledby="hours" className="self-start rounded-3xl border bg-card p-6">
            <h2 id="hours" className="flex items-center gap-2 text-2xl font-semibold">
              <ClockIcon className="size-5 text-terracotta" aria-hidden />
              Studio hours
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Philippine time.</p>
            <dl className="mt-4 divide-y">
              {hours.map(({ day, windows }) => (
                <div key={day} className="flex justify-between gap-4 py-2.5">
                  <dt className="font-semibold">{WEEKDAYS[day]}</dt>
                  <dd
                    className={windows.length ? "text-right" : "text-right text-muted-foreground"}
                  >
                    {windows.length
                      ? windows
                          .map((w) => `${formatTime(w.start)} – ${formatTime(w.end)}`)
                          .join(", ")
                      : "Closed"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </section>
    </>
  );
}
