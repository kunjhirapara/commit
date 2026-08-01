"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import { buildClerkAppearance } from "@/lib/clerkAppearance";

/**
 * Theme-aware Clerk appearance.
 *
 * A hook rather than a value on `<ClerkProvider>` because that provider sits
 * *above* `ThemeProvider` in the root layout, so `useTheme()` is not available
 * where the provider is constructed. Every Clerk component that renders visible
 * chrome — the sign-in and sign-up forms, the navbar's modals, `UserButton` —
 * sits comfortably inside `ThemeProvider`, so reading the theme at the point of
 * use avoids restructuring the provider tree.
 */
export const useClerkAppearance = () => {
  const { resolvedTheme } = useTheme();

  return useMemo(
    () => buildClerkAppearance(resolvedTheme === "dark"),
    [resolvedTheme],
  );
};
