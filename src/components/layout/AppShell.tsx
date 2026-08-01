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
      <Navbar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
