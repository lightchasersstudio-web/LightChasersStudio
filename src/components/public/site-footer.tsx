import { ArrowUpRightIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/public/brand-logo";
import { SITE_NAV } from "@/components/public/site-nav";
import { Sparkle } from "@/components/shared/sparkle";
import { currentYear, getPublicSettings } from "@/server/queries/public";

export async function SiteFooter() {
  const [s, year] = await Promise.all([getPublicSettings(), currentYear()]);
  const socials = socialLinks(s);

  return (
    <footer className="mt-24 bg-panel text-panel-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <BrandLogo logoPath={s.logo_path} name={s.business_name} size={72} />
          <p className="flex items-center gap-2 font-script text-2xl text-panel-foreground">
            <Sparkle className="size-3.5 text-terracotta" />
            {s.tagline ?? "chasing the light"}
          </p>
          {socials.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {socials.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 rounded-full border border-panel-foreground/25 px-4 text-sm font-semibold transition-colors hover:bg-panel-foreground/10"
                  >
                    {label}
                    <ArrowUpRightIcon className="size-3.5" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label="Footer">
          <h2 className="font-heading text-lg font-semibold">Explore</h2>
          <ul className="mt-3 space-y-1">
            {SITE_NAV.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-10 items-center text-panel-foreground/85 hover:text-panel-foreground hover:underline"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="font-heading text-lg font-semibold">Say hello</h2>
          <ul className="mt-3 space-y-3 text-panel-foreground/85">
            {s.email && (
              <li>
                <a
                  href={`mailto:${s.email}`}
                  className="inline-flex items-center gap-2 break-all hover:text-panel-foreground hover:underline"
                >
                  <MailIcon className="size-4 shrink-0" aria-hidden />
                  {s.email}
                </a>
              </li>
            )}
            {s.phone && (
              <li>
                <a
                  href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex items-center gap-2 hover:text-panel-foreground hover:underline"
                >
                  <PhoneIcon className="size-4 shrink-0" aria-hidden />
                  {s.phone}
                </a>
              </li>
            )}
            <li className="flex items-start gap-2">
              <MapPinIcon className="mt-1 size-4 shrink-0" aria-hidden />
              {s.address ?? s.city}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-panel-foreground/15">
        <p className="mx-auto max-w-6xl px-4 py-5 text-sm text-panel-foreground/85 sm:px-6">
          © {year} {s.business_name} · {s.city}, Philippines
        </p>
      </div>
    </footer>
  );
}

export function socialLinks(s: {
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
}) {
  return [
    { label: "Facebook", href: s.facebook_url },
    { label: "Instagram", href: s.instagram_url },
    { label: "TikTok", href: s.tiktok_url },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href));
}
