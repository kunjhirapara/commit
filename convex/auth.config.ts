export default {
  providers: [
    {
      domain: process.env.CLERK_ISSUER_URL ?? "https://boss-peacock-93.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
