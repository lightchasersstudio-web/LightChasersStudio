import { ArrowUpRightIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";

import { BrandLockup } from "@/components/public/brand-lockup";
import { FacebookIcon } from "@/components/shared/facebook-icon";
import { Sparkle } from "@/components/shared/sparkle";
import { displayUrl, studioMapsUrl } from "@/lib/utils/social";
import { currentYear, getPublicSettings } from "@/server/queries/public";

const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * Brand on the left; the studio's address (opens Google Maps), Facebook page and
 * number on the right. Email and the full list of ways to reach us live on /contact.
 */
export async function SiteFooter() {
  const [s, year] = await Promise.all([getPublicSettings(), currentYear()]);
  const place = s.address ?? s.city;
  const otherSocials = socialLinks(s).filter((l) => l.label !== "Facebook");
  const linkClass =
    "group inline-flex min-h-11 items-start gap-3 text-panel-foreground/90 hover:text-panel-foreground";
  const iconClass =
    "grid size-9 shrink-0 place-items-center rounded-full bg-panel-foreground/10 transition-colors group-hover:bg-panel-foreground/20";

  return (
    <footer id="site-footer" className="mt-24 bg-panel text-panel-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <BrandLockup name={s.business_name} tone="light" className="text-xl" />
          <p className="flex items-center gap-2 font-script text-2xl text-panel-foreground">
            <Sparkle className="size-3.5 text-terracotta" />
            {s.tagline ?? "chasing the light"}
          </p>
          {otherSocials.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {otherSocials.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    {...NEW_TAB}
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

        <address className="not-italic">
          <ul className="space-y-3">
            <li>
              <a href={studioMapsUrl(s)} {...NEW_TAB} className={linkClass}>
                <span className={iconClass}>
                  <MapPinIcon className="size-4" aria-hidden />
                </span>
                <span className="pt-1.5">
                  <span className="underline-offset-4 group-hover:underline">{place}</span>
                  <span className="sr-only"> (opens Google Maps in a new tab)</span>
                </span>
              </a>
            </li>
            {s.facebook_url && (
              <li>
                <a href={s.facebook_url} {...NEW_TAB} className={linkClass}>
                  <span className={iconClass}>
                    <FacebookIcon className="size-4" />
                  </span>
                  <span className="pt-1.5 break-all underline-offset-4 group-hover:underline">
                    {displayUrl(s.facebook_url)}
                    <span className="sr-only"> (our Facebook page, opens in a new tab)</span>
                  </span>
                </a>
              </li>
            )}
            {s.phone && (
              <li>
                <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className={linkClass}>
                  <span className={iconClass}>
                    <PhoneIcon className="size-4" aria-hidden />
                  </span>
                  <span className="pt-1.5 underline-offset-4 group-hover:underline">
                    <span className="sr-only">Call </span>
                    {s.phone}
                  </span>
                </a>
              </li>
            )}
          </ul>
        </address>
      </div>
      <div className="border-t border-panel-foreground/15">
        <p className="mx-auto max-w-6xl px-4 py-5 text-center text-sm text-panel-foreground/85 sm:px-6">
          © {year} {s.business_name} · {s.city}, Philippines ·{" "}
          {/* The booking form's privacy consent points here, so it stays reachable. */}
          <Link
            href="/privacy"
            className="underline-offset-4 hover:text-panel-foreground hover:underline"
          >
            Privacy policy
          </Link>
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
