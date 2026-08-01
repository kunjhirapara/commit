import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Create a Commit account and start practising in the coding sandbox.",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
