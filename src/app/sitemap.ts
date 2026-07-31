import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Only the publicly reachable routes — see PUBLIC_ROUTES in src/lib/routeAccess.ts. */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/terms", "/privacy", "/recording-disclosure"];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    changeFrequency: route === "" ? "weekly" : "yearly",
    priority: route === "" ? 1 : 0.3,
  }));
}
