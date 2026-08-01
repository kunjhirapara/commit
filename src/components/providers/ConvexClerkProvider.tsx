"use client";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { UserSyncStatusProvider } from "@/components/providers/UserSyncStatusProvider";
import { getValidatedClientEnv } from "@/lib/env";

const clientEnv = getValidatedClientEnv();
const convex = new ConvexReactClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);

function ConvexClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    // No `appearance` here on purpose. It needs the resolved theme, and this
    // provider sits above ThemeProvider, so `useTheme()` is unavailable at this
    // point in the tree. Each Clerk surface applies it instead via
    // useClerkAppearance, which runs where the theme is known.
    <ClerkProvider
      signInUrl="/signin"
      signUpUrl="/signup"
      publishableKey={clientEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <UserSyncStatusProvider>{children}</UserSyncStatusProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

export default ConvexClerkProvider;
