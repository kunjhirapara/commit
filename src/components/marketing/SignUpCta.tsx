import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Wraps the landing page's primary call to action in a link to /signup.
 *
 * This used to be the only part of the landing page that needed client
 * JavaScript: Clerk's SignUpButton opened a modal, so it could not be a server
 * component, and it was the sole reason LandingPage was `"use client"` in its
 * entirety. That mattered — with the whole page on the client the hero rendered
 * only after Clerk booted in the browser, which put LCP at 6.5s on mobile and
 * left the served HTML with no <h1> for crawlers.
 *
 * Sign-up is now a real page rather than a modal, so this is a link and the
 * boundary is gone. The wrapper is kept rather than inlined so LandingPage does
 * not have to know where sign-up lives, and so the reasoning above stays
 * attached to the thing it explains.
 */
export default function SignUpCta({ children }: { children: ReactNode }) {
  return <Link href="/signup">{children}</Link>;
}
