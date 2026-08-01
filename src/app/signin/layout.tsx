import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Exists only to give the route its own <title>. The page is a client component
 * because it reads `redirect_url`, and client components cannot export metadata.
 */
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Commit to reach your interviews and practice sandbox.",
  // Auth pages carry no content worth indexing and can appear as duplicates.
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
