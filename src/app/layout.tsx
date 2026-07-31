import type { Metadata } from "next";
import localFont from "next/font/local";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import "./globals.css";
import ConvexClerkProvider from "@/components/providers/ConvexClerkProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "sonner";
import { getValidatedServerEnv } from "@/lib/env";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const siteDescription =
  "Run technical interviews end to end: HD video, a shared code editor, and a sandboxed runner for JavaScript, Python and Java — plus structured scorecards for the debrief.";

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
    <ConvexClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
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
    </ConvexClerkProvider>
  );
}
