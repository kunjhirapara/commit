import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
