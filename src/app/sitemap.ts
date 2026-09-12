import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/siteUrl";

/** Only the publicly reachable routes — see PUBLIC_ROUTES in src/lib/routeAccess.ts. */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/terms", "/privacy", "/recording-disclosure"];

  return routes.map((route) => ({
    url: absoluteUrl(route),
    changeFrequency: route === "" ? "weekly" : "yearly",
    priority: route === "" ? 1 : 0.3,
  }));
}
