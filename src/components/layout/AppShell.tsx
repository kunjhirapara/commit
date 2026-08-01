import { ReactNode } from "react";
import Navbar from "@/components/ui/Navbar";
import SiteFooter from "@/components/layout/SiteFooter";

/**
 * Chrome shared by every rendered page — signed in or out.
 *
 * This used to live in the root layout inside a <SignedIn> wrapper, which is why
 * signed-out visitors got a blank page. It is a plain component now so both the
 * (root) and (admin) route groups can mount it, and so auth can be enforced in
 * middleware instead.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/*
        A skip link existed only inside DashboardShell, so keyboard users on the
        landing page, home, practice, calendar and settings had to tab through
        the whole navbar on every navigation. Hidden until focused.
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        Skip to main content
      </a>

      <Navbar />
      <main id="main-content" className="flex-1 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
