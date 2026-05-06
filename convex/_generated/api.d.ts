/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auditLogs from "../auditLogs.js";
import type * as calendarEvents from "../calendarEvents.js";
import type * as comments from "../comments.js";
import type * as feedback from "../feedback.js";
import type * as http from "../http.js";
import type * as interviews from "../interviews.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_errorUtils from "../lib/errorUtils.js";
import type * as notifications_emailActions from "../notifications/emailActions.js";
import type * as notifications_index from "../notifications/index.js";
import type * as observability from "../observability.js";
import type * as reliability from "../reliability.js";
import type * as sessionEvents from "../sessionEvents.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auditLogs: typeof auditLogs;
  calendarEvents: typeof calendarEvents;
  comments: typeof comments;
  feedback: typeof feedback;
  http: typeof http;
  interviews: typeof interviews;
  "lib/authz": typeof lib_authz;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/errorUtils": typeof lib_errorUtils;
  "notifications/emailActions": typeof notifications_emailActions;
  "notifications/index": typeof notifications_index;
  observability: typeof observability;
  reliability: typeof reliability;
  sessionEvents: typeof sessionEvents;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
