import type { Metadata } from "next";
import localFont from "next/font/local";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ConvexAuthProvider from "@/components/providers/ConvexAuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "sonner";
import { getValidatedServerEnv } from "@/lib/env";
import { siteUrl } from "@/lib/siteUrl";
import {
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
} from "@/lib/seo/structuredData";

/**
 * The body face, self-hosted at build time.
 *
 * globals.css used to pull this in with
 * `@import url("https://fonts.googleapis.com/...")` on line 1, which is the
 * slowest way to load a webfont: the browser has to parse our stylesheet,
 * discover the @import, fetch Google's CSS, parse that, and only then fetch the
 * files — three serial round trips to a third party, blocking text rendering on
 * every page. next/font/google inlines the @font-face rules, self-hosts the
 * files, preloads them, and generates fallback metrics so there is no layout
 * shift when they land. Same typeface, no third-party request.
 */
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  // 800 was dropped because `font-extrabold` appears nowhere in the app: the
  // file was fetched on every visit and never rendered a glyph. Each weight is
  // its own request against the render-blocking budget, so the remaining four
  // are the ones Tailwind actually asks for — font-normal, font-medium,
  // font-semibold and font-bold.
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta-sans",
  display: "swap",
});

/**
 * `font-mono` is used by the wordmark, the language chips and the code editor
 * output, but `--font-mono` was never defined, so all of it fell back to
 * whatever monospace the OS supplies — while this file was downloaded on every
 * visit and never rendered a glyph. It is wired up in globals.css now.
 */
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

// 152 characters. Google truncates the snippet around 155-160, so the previous
// 169-character version lost "for the debrief" in the SERP anyway.
const siteDescription =
  "Run technical interviews end to end: HD video, a shared code editor, and a sandboxed runner for JavaScript, Python and Java, plus structured scorecards.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Commit — technical interviews with a live code editor",
    template: "%s · Commit",
  },
  description: siteDescription,
  applicationName: "Commit",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Commit",
    title: "Commit — technical interviews with a live code editor",
    description: siteDescription,
    // og:image comes from src/app/opengraph-image.tsx via the file convention.
  },
  twitter: {
    card: "summary_large_image",
    title: "Commit — technical interviews with a live code editor",
    description: siteDescription,
  },
  robots: { index: true, follow: true },
  // Without this the live HTML had no rel="canonical" at all, so any URL that
  // reaches this page — a tracking parameter, a trailing slash variant — is a
  // separate document as far as a crawler is concerned. Resolved against
  // metadataBase, so "/" is the site root rather than a relative path.
  alternates: { canonical: "/" },
};

/**
 * Root layout deliberately does NOT gate on auth. Authentication is enforced in
 * middleware (see src/lib/routeAccess.ts), which lets public routes render real
 * content instead of redirecting every visitor to Clerk. The signed-in shell —
 * navbar, main padding, Stream client — lives in src/app/(root)/layout.tsx.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  getValidatedServerEnv();

  return (
    <ConvexAuthProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/*
            JSON-LD for crawlers and AI search engines. The latter do not rank
            pages, they cite sources, and structured data is how one learns what
            this product is without inferring it from marketing prose.

            dangerouslySetInnerHTML is the documented way to emit JSON-LD in
            React: the content is a JSON string built from our own constants,
            never user input, and React would otherwise HTML-escape the quotes
            into something no parser accepts.
          */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify([
                buildOrganizationSchema(siteUrl),
                buildSoftwareApplicationSchema(siteUrl),
              ]),
            }}
          />
        </head>
        <body
          className={`${jakartaSans.variable} ${geistMono.variable} antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange>
            {children}
          </ThemeProvider>
          <Toaster position="top-right" />
        </body>
      </html>
    </ConvexAuthProvider>
  );
}
