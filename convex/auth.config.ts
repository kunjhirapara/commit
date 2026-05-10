const clerkIssuerUrl = process.env.CLERK_ISSUER_URL;

if (!clerkIssuerUrl) {
  throw new Error(
    "Missing CLERK_ISSUER_URL in Convex environment. Set it to your Clerk JWT issuer, for example with `npx convex env set CLERK_ISSUER_URL https://your-clerk-issuer`.",
  );
}

export default {
  providers: [
    {
      domain: clerkIssuerUrl,
      applicationID: "convex",
    },
  ],
};
