import type { MetadataRoute } from "next";
import { BRAND_BACKGROUND, BRAND_ORANGE } from "@/lib/brandMark";

/**
 * Declared so the browser has a name, a theme colour and an icon to use when
 * someone installs or pins the site. PageSpeed flagged the absence of both a
 * manifest and a theme-color.
 *
 * Icons point at /brand/*.png rather than the generated /icon route: a manifest
 * is fetched by installers that expect stable, cacheable URLs, and the files in
 * public/ are exactly the ones checked into the repo and uploaded to Google, so
 * an installed icon cannot differ from the verified consent-screen logo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Commit — technical interviews with a live code editor",
    short_name: "Commit",
    description:
      "Run technical interviews end to end: video, a shared code editor, and a sandboxed runner.",
    start_url: "/",
    display: "standalone",
    background_color: BRAND_BACKGROUND,
    theme_color: BRAND_ORANGE,
    icons: [
      { src: "/brand/logo-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
