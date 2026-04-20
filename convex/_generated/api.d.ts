/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auditLogs from "../auditLogs.js";
import type * as authz from "../authz.js";
import type * as comments from "../comments.js";
import type * as errorUtils from "../errorUtils.js";
import type * as feedback from "../feedback.js";
import type * as http from "../http.js";
import type * as interviews from "../interviews.js";
import type * as notifications from "../notifications.js";
import type * as observability from "../observability.js";
import type * as sessionEvents from "../sessionEvents.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auditLogs: typeof auditLogs;
  authz: typeof authz;
  comments: typeof comments;
  errorUtils: typeof errorUtils;
  feedback: typeof feedback;
  http: typeof http;
  interviews: typeof interviews;
  notifications: typeof notifications;
  observability: typeof observability;
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
