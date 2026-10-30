import type { MetadataRoute } from "next";

import { SITE_NAV } from "@/components/public/site-nav";
import { getPublicEnv } from "@/lib/env";
import { listActiveServices } from "@/server/queries/public";

/** Public pages and every active package page, for search engines. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getPublicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const services = await listActiveServices();
  return [
    ...[...SITE_NAV.map((n) => n.href), "/prepare", "/book", "/privacy"].map((path) => ({
      url: `${site}${path === "/" ? "" : path}`,
    })),
    ...services.map((s) => ({ url: `${site}/services/${s.slug}` })),
  ];
}
