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
