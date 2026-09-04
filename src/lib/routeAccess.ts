export type AppRole =
  | "candidate"
  | "interviewer"
  | "recruiter"
  | "developer"
  | "admin";

export type RouteRule = {
  pattern: RegExp;
  allowedRoles: AppRole[];
};

export const PROTECTED_ROUTES: RouteRule[] = [
  { pattern: /^\/dashboard\/developer(\/|$)/, allowedRoles: ["developer", "admin"] },
  { pattern: /^\/dashboard\/roles(\/|$)/, allowedRoles: ["developer", "admin"] },
  { pattern: /^\/dashboard\/team(\/|$)/, allowedRoles: ["recruiter", "admin"] },
  {
    pattern: /^\/dashboard\/interviews(\/|$)/,
    allowedRoles: ["interviewer", "recruiter", "admin"],
  },
  {
    pattern: /^\/dashboard(\/|$)/,
    allowedRoles: ["interviewer", "recruiter", "developer", "admin"],
  },
  { pattern: /^\/schedule(\/|$)/, allowedRoles: ["recruiter", "admin"] },
  {
    pattern: /^\/recordings(\/|$)/,
    allowedRoles: ["interviewer", "recruiter", "admin"],
  },
];

export const findRouteRule = (pathname: string): RouteRule | undefined =>
  PROTECTED_ROUTES.find((rule) => rule.pattern.test(pathname));

/**
 * The roles a path requires, or undefined when it has no rule.
 *
 * RoleGuard reads this instead of each page repeating its own role list, which
 * is what let the middleware copy drift from the page copy.
 */
export const getRequiredRolesForPath = (
  pathname: string,
): AppRole[] | undefined => findRouteRule(pathname)?.allowedRoles;

/**
 * Routes a signed-out visitor may load.
 *
 * Everything not listed here requires authentication, enforced in middleware via
 * `auth.protect()`. Previously the whole app was gated by a `<SignedIn>` wrapper in
 * the root layout, which meant even the legal pages were invisible to the public and
 * there was nowhere to put a landing page.
 *
 * `/` is public because it serves the marketing page when signed out and the app
 * home when signed in.
 */
export const PUBLIC_ROUTES: RegExp[] = [
  /^\/$/,
  // The two auth pages. `/sign-in` and `/sign-up` used to be listed here as
  // well, but no such routes ever existed, so anything sent to them 404'd —
  // declarations for pages that were never built.
  /^\/signin(\/|$)/,
  /^\/signup(\/|$)/,
  /^\/terms(\/|$)/,
  /^\/privacy(\/|$)/,
  /^\/recording-disclosure(\/|$)/,
  // Generated public metadata. These are route handlers, not files under
  // /public, so the middleware matcher's static-asset extension list never sees
  // them — it skips by file extension and knows nothing of .txt, .xml, or the
  // extensionless /opengraph-image. Without these three entries all of them
  // answered a signed-out request with 307 → /signin: Google never read the
  // robots or sitemap, and every link unfurl got a login page instead of a card.
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/opengraph-image$/,
  // Same trap as /opengraph-image: Next serves the icon conventions at
  // extensionless paths, so the matcher cannot skip them and a signed-out
  // visitor would get a redirect where a favicon should be.
  // /manifest.webmanifest and /favicon.ico do not need listing — the matcher's
  // extension list already covers `webmanifest` and `ico`.
  /^\/icon$/,
  /^\/apple-icon$/,
  // Health is polled by the container healthcheck, which carries no session.
  /^\/api\/health(\/|$)/,
  // Clerk posts here with a webhook signature, not a user session.
  /^\/api\/webhooks(\/|$)/,
];

export const isPublicRoute = (pathname: string): boolean =>
  PUBLIC_ROUTES.some((pattern) => pattern.test(pathname));
