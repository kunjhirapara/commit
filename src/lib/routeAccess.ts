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
  /^\/signin(\/|$)/,
  /^\/sign-in(\/|$)/,
  /^\/sign-up(\/|$)/,
  /^\/terms(\/|$)/,
  /^\/privacy(\/|$)/,
  /^\/recording-disclosure(\/|$)/,
  // Health is polled by the container healthcheck, which carries no session.
  /^\/api\/health(\/|$)/,
  // Clerk posts here with a webhook signature, not a user session.
  /^\/api\/webhooks(\/|$)/,
];

export const isPublicRoute = (pathname: string): boolean =>
  PUBLIC_ROUTES.some((pattern) => pattern.test(pathname));
