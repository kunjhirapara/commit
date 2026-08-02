"use client";

import { SignUpButton } from "@clerk/nextjs";
import type { ReactNode } from "react";

/**
 * The only part of the landing page that needs client JavaScript.
 *
 * SignUpButton opens Clerk's modal, so it cannot be a server component — but it
 * is the sole reason LandingPage used to be `"use client"` in its entirety.
 * That mattered: with the whole page on the client, the hero rendered only after
 * Clerk booted in the browser, which is what put LCP at 6.5s on mobile and left
 * the served HTML with no <h1> for crawlers.
 *
 * `children` crosses the boundary as an already-rendered server element, so the
 * button's markup still ships in the initial HTML. Only this wrapper's handler
 * arrives as JavaScript.
 */
export default function SignUpCta({ children }: { children: ReactNode }) {
  return <SignUpButton mode="modal">{children}</SignUpButton>;
}
