"use client";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { UserSyncStatusProvider } from "@/components/providers/UserSyncStatusProvider";
import { getValidatedClientEnv } from "@/lib/env";
import { clerkAppearance } from "@/lib/clerkAppearance";

const clientEnv = getValidatedClientEnv();
const convex = new ConvexReactClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);

function ConvexClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    // `appearance` is set here rather than per-surface so the sign-in page, the
    // navbar modals and UserButton share one definition. See lib/clerkAppearance
    // for why it uses Tailwind classes instead of colour variables.
    <ClerkProvider
      appearance={clerkAppearance}
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
