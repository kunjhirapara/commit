import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Everything below requires a session, so crawling it only produces
      // redirects to Clerk.
      disallow: [
        "/api/",
        "/dashboard",
        "/meeting",
        "/schedule",
        "/recordings",
        "/settings",
        "/calendar",
        "/practice",
        "/accept-invitation",
        "/call-ended",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
