"use client";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useSyncUser } from "@/hooks/useSyncUser";
import { getValidatedClientEnv } from "@/lib/env";

const clientEnv = getValidatedClientEnv();
const convex = new ConvexReactClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);

function SyncUserProvider({ children }: { children: React.ReactNode }) {
  useSyncUser();
  return <>{children}</>;
}

function ConvexClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={clientEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <SyncUserProvider>{children}</SyncUserProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

export default ConvexClerkProvider;
