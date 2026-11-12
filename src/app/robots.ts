import type { MetadataRoute } from "next";

import { getPublicEnv } from "@/lib/env";

/** Keep the admin and the private booking pages out of search results. */
export default function robots(): MetadataRoute.Robots {
  const site = getPublicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/booking",
        "/book/done",
        "/book/cancelled",
        "/book/mock-checkout",
      ],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
