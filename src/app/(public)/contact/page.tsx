import { ArrowUpRightIcon, ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import type { Metadata } from "next";

import { SectionHeading } from "@/components/public/section-heading";
import { socialLinks } from "@/components/public/site-footer";
import { WEEKDAYS } from "@/lib/catalog";
import { formatTime } from "@/lib/utils/format";
import { getOpeningHours, getPublicSettings } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Light Chasers Studio in Zamboanga City to book a photo session.",
};

export default async function ContactPage() {
  const [s, hours] = await Promise.all([getPublicSettings(), getOpeningHours()]);
  const socials = socialLinks(s);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address ?? s.city)}`;

  const channels = [
    s.email && { icon: MailIcon, label: "Email", value: s.email, href: `mailto:${s.email}` },
    s.phone && {
      icon: PhoneIcon,
      label: "Call or text",
      value: s.phone,
      href: `tel:${s.phone.replace(/[^\d+]/g, "")}`,
    },
    {
      icon: MapPinIcon,
      label: "Studio",
      value: s.address ?? s.city,
      href: mapsUrl,
      external: true,
    },
  ].filter(Boolean) as {
    icon: typeof MailIcon;
    label: string;
    value: string;
    href: string;
    external?: boolean;
  }[];

  return (
    <section className="bg-studio">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading
          as="h1"
          eyebrow="say hello"
          title="Let's plan your session"
          description="Online booking is coming soon. For now, message us with your preferred date, the kind of shoot, and where. We'll reply as soon as we can."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <ul className="grid gap-4 sm:grid-cols-2">
            {channels.map(({ icon: Icon, label, value, href, external }) => (
              <li key={label} className={label === "Studio" ? "sm:col-span-2" : undefined}>
                <a
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex h-full items-start gap-4 rounded-3xl border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-terracotta hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition-colors group-hover:bg-terracotta group-hover:text-white">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-muted-foreground">{label}</span>
                    <span className="block font-semibold break-words">{value}</span>
                    {external && <span className="sr-only">(opens Google Maps in a new tab)</span>}
                  </span>
                </a>
              </li>
            ))}
            {socials.length > 0 && (
              <li className="sm:col-span-2">
                <div className="rounded-3xl border bg-card p-5">
                  <p className="text-sm text-muted-foreground">Follow along</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {socials.map(({ label, href }) => (
                      <li key={label}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
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

          <section aria-labelledby="hours" className="rounded-3xl border bg-card p-6">
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
      </div>
    </section>
  );
}
