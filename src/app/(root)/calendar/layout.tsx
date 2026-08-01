import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Exists only to give the route its own <title>. The page itself is a client
 * component, and those cannot export metadata — without this, every route
 * rendered the root layout's default title, so browser tabs, history entries
 * and bookmarks were indistinguishable from one another.
 */
export const metadata: Metadata = {
  title: "Calendar",
  description: "Your interviews and personal events, month by month.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
